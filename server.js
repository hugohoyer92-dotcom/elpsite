const express = require("express");
const cors = require("cors");
const Stripe = require("stripe");
const paypal = require("@paypal/checkout-server-sdk");
const { Configuration, OpenAIApi } = require("openai");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// Replace the placeholder with your real Stripe secret key or set STRIPE_SECRET_KEY in the environment.
const stripeSecretKey =
  process.env.STRIPE_SECRET_KEY || "sk_test_REPLACE_WITH_YOUR_STRIPE_SECRET_KEY";
const stripe = new Stripe(stripeSecretKey);

const openAiKey = process.env.OPENAI_API_KEY || "";
const openaiClient = openAiKey
  ? new OpenAIApi(new Configuration({ apiKey: openAiKey }))
  : null;

const aiKnowledge = [
  {
    keywords: ["capture", "carte"],
    reply:
      "La Capture Card 4K Ultra prend en charge 2160p60 HDR, 1440p144Hz et 1080p240Hz, avec enregistrement 1080p120 et 2160p30. Elle n’a besoin d’aucune alimentation externe et propose un port audio line-in.",
  },
  {
    keywords: ["monitor", "moniteur"],
    reply:
      "Nos moniteurs PC Gaming 24\" offrent 120Hz, 1 ms de réponse, panneau IPS 99% sRGB, bordure sans cadre, support fixe et interfaces HD/DP. Ils sont calibrés pour les streamers exigeants.",
  },
  {
    keywords: ["ds4", "ai", "guide"],
    reply:
      "Le guide DS4 IA inclut une installation complète, des réglages d’aimlock fluide et une optimisation pour rester indétectable tout en gardant la stabilité du signal.",
  },
  {
    keywords: ["paiement", "checkout", "stripe", "paypal"],
    reply:
      "Les paiements sont sécurisés via Stripe Checkout ou PayPal. Les transactions sont chiffrées avec TLS 1.3 et validées par 3D Secure lorsque c’est nécessaire.",
  },
];

const findKnowledgeEntry = (text) => {
  const lower = text.toLowerCase();
  return (
    aiKnowledge.find((entry) => entry.keywords.some((keyword) => lower.includes(keyword))) || null
  );
};

// Replace with your PayPal credentials or export PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.
const paypalClientId =
  process.env.PAYPAL_CLIENT_ID || "PAYPAL_CLIENT_ID_REPLACE_ME";
const paypalClientSecret =
  process.env.PAYPAL_CLIENT_SECRET || "PAYPAL_CLIENT_SECRET_REPLACE_ME";

const createPayPalClient = () => {
  const environment = new paypal.core.SandboxEnvironment(
    paypalClientId,
    paypalClientSecret
  );
  return new paypal.core.PayPalHttpClient(environment);
};

const paypalClient = createPayPalClient();

app.post("/create-checkout-session", async (req, res) => {
  try {
    const {
      items = [],
      shippingFee = 0,
      customer = {},
      success_url,
      cancel_url,
      currency = "EUR",
    } = req.body;

    const lineItems = items.map((item) => ({
      price_data: {
        currency,
        unit_amount: Math.round(item.price * 100),
        product_data: {
          name: item.title,
          description: item.description || "Produit ELP",
        },
      },
      quantity: item.quantity,
    }));

    if (shippingFee > 0) {
      lineItems.push({
        price_data: {
          currency,
          unit_amount: Math.round(shippingFee * 100),
          product_data: {
            name: "Frais de support premium",
          },
        },
        quantity: 1,
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: success_url || `${req.headers.origin}/payment-success.html`,
      cancel_url: cancel_url || `${req.headers.origin}/payment-failed.html`,
      metadata: {
        customer_name: customer.name,
        customer_email: customer.email,
      },
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout error", error);
    res.status(500).json({ error: "Impossible de lancer Stripe Checkout" });
  }
});

app.post("/create-paypal-order", async (req, res) => {
  try {
    const {
      items = [],
      shippingFee = 0,
      success_url,
      cancel_url,
      currency = "EUR",
    } = req.body;
    const subtotal = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const total = (subtotal + shippingFee).toFixed(2);
    const orderRequest = new paypal.orders.OrdersCreateRequest();
    orderRequest.requestBody({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: currency,
            value: total,
            breakdown: {
              item_total: {
                currency_code: currency,
                value: subtotal.toFixed(2),
              },
              shipping: {
                currency_code: currency,
                value: shippingFee.toFixed(2),
              },
            },
          },
          description: "Commande ELP - équipements et services gaming",
        },
      ],
      application_context: {
        return_url: success_url || `${req.headers.origin}/payment-success.html`,
        cancel_url: cancel_url || `${req.headers.origin}/payment-failed.html`,
        brand_name: "ELP Gaming",
        user_action: "PAY_NOW",
      },
    });

    const order = await paypalClient.execute(orderRequest);
    const approvalUrl = order.result.links.find((link) => link.rel === "approve");
    if (!approvalUrl) {
      throw new Error("Lien d'approbation PayPal manquant");
    }
    res.json({ approvalUrl: approvalUrl.href });
  } catch (error) {
    console.error("PayPal order error", error);
    res.status(500).json({ error: "Impossible de lancer PayPal" });
  }
});

const chatSystemPrompt =
  "Tu es l'assistant ELP, un conseiller service client spécialisé dans les produits et services gaming. Réponds en français, reste professionnel, cite des caractéristiques techniques lorsque c'est pertinent, et propose des liens vers les pages du site quand cela aide (ex: 'Voir nos produits').";

const getFallbackReply = (message) => {
  const entry = findKnowledgeEntry(message);
  if (entry) return entry.reply;
  return (
    "Je suis l'assistant ELP. Posez-moi une question sur les cartes de capture, les moniteurs, les services DS4 IA ou nos paiements. " +
    "Pour en savoir plus, rendez-vous sur nos pages Produits ou Services."
  );
};

app.post("/chat", async (req, res) => {
  const message = (req.body?.message || "").trim();
  if (!message) {
    return res.status(400).json({ error: "Le message est requis." });
  }

  if (!openaiClient) {
    return res.json({ reply: getFallbackReply(message) });
  }

  try {
    const completion = await openaiClient.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: chatSystemPrompt },
        { role: "user", content: message },
      ],
      temperature: 0.35,
    });
    const reply = completion?.choices?.[0]?.message?.content?.trim();
    return res.json({ reply: reply || getFallbackReply(message) });
  } catch (error) {
    console.error("OpenAI chat error", error);
    return res.status(500).json({
      reply: getFallbackReply(message),
      error: "Impossible de joindre le service IA pour le moment.",
    });
  }
});

const PORT = process.env.PORT || 4242;
app.listen(PORT, () => {
  console.log(`ELP payment server running on port ${PORT}`);
});
