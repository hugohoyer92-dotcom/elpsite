const cartKey = "elp_cart_v2";
const paymentHost = (window.ELP_PAYMENT_HOST || "").replace(/\/$/, "");
const lightboxes = new Map();

const buildEndpoint = (path) => {
  if (paymentHost) {
    return `${paymentHost}${path}`;
  }
  return path;
};

const getStoredCart = () => {
  try {
    const raw = localStorage.getItem(cartKey);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error("Impossible de lire le panier", error);
    return [];
  }
};

const setStoredCart = (cart) => {
  localStorage.setItem(cartKey, JSON.stringify(cart));
};

const notifyCartUpdate = () => {
  const totalItems = getStoredCart().reduce((sum, item) => sum + item.quantity, 0);
  document.querySelectorAll("[data-cart-count]").forEach((el) => {
    el.textContent = totalItems;
  });
};

const renderCheckoutSummary = () => {
  const container = document.getElementById("summary-items");
  if (!container) return;
  const cart = getStoredCart();
  container.innerHTML = "";
  if (!cart.length) {
    container.innerHTML = '<p class="empty">Panier vide</p>';
    return;
  }
  cart.forEach((item) => {
    const row = document.createElement("div");
    row.className = "order-item";
    row.innerHTML = `
      <span>${item.quantity} × ${item.title}</span>
      <strong>${(item.price * item.quantity).toFixed(2)}€</strong>
    `;
    container.appendChild(row);
  });
};

const reviewStorageKey = "elp_reviews_v1";
const reviewPendingKey = "elp_review_pending_v1";
const reviewSeed = [
  {
    id: "seed-1",
    name: "Aria K.",
    rating: 5,
    comment: "Installation parfaite et support ultra disponible, je recommande les stations ELP.",
    createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
  },
  {
    id: "seed-2",
    name: "Lucien V.",
    rating: 4,
    comment: "La capture card m’a permis de passer en 4K sans lag, très propre.",
    createdAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
  },
];

const getStoredReviews = () => {
  try {
    const raw = localStorage.getItem(reviewStorageKey);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error("Impossible de lire les avis", error);
    return [];
  }
};

const setStoredReviews = (reviews) => {
  localStorage.setItem(reviewStorageKey, JSON.stringify(reviews));
};

const renderReviews = () => {
  const container = document.getElementById("review-list");
  if (!container) return;
  const stored = getStoredReviews();
  const reviews = stored.length ? stored : reviewSeed;
  const markup = reviews
    .map((review) => {
      const date = new Date(review.createdAt).toLocaleDateString("fr-FR", {
        month: "long",
        day: "numeric",
      });
      const stars = Array.from({ length: 5 })
        .map((_, i) => `<span class="${i < review.rating ? "active" : ""}">★</span>`)
        .join("");
      return `
        <article class="review-item">
          <div class="review-stars">${stars}</div>
          <h4>${review.name}${review.auto ? " — avis automatique" : ""}</h4>
          <small>${date}</small>
          <p>${review.comment}</p>
        </article>
      `;
    })
    .join("");
  container.innerHTML = markup;
};

const addReview = (review) => {
  const reviews = getStoredReviews();
  reviews.unshift({
    id: review.id ?? `rev-${Date.now()}`,
    rating: review.rating ?? 5,
    comment: review.comment || "Avis laissé via notre interface.",
    name: review.name || "Client ELP",
    createdAt: review.createdAt ?? Date.now(),
    auto: review.auto || false,
  });
  setStoredReviews(reviews.slice(0, 20));
  renderReviews();
};

const maybeAutoReview = () => {
  const pending = JSON.parse(localStorage.getItem(reviewPendingKey) || "null");
  if (!pending || pending.submitted) return;
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  if (Date.now() - pending.orderDate >= oneWeek) {
    addReview({
      rating: pending.rating || 5,
      name: pending.name || "Client ELP",
      comment: "Avis ajouté automatiquement pour rappeler votre commande.",
      createdAt: Date.now(),
      auto: true,
    });
    localStorage.removeItem(reviewPendingKey);
  }
};

const markPendingReview = (customer) => {
  const payload = {
    orderDate: Date.now(),
    name: customer.name,
    submitted: false,
    rating: 5,
  };
  localStorage.setItem(reviewPendingKey, JSON.stringify(payload));
};

const clearPendingReview = () => {
  localStorage.removeItem(reviewPendingKey);
};

const registerReviewForm = () => {
  const form = document.getElementById("review-form");
  if (!form) return;
  const starInput = document.getElementById("review-rating");
  const starButtons = form.querySelectorAll("[data-star]");
  let rating = Number(starInput.value) || 5;
  const highlight = (value) => {
    rating = value;
    starButtons.forEach((button) => {
      const value = Number(button.dataset.star);
      button.classList.toggle("active", value <= rating);
    });
    starInput.value = String(rating);
  };
  highlight(rating);
  form.querySelector(".star-picker").addEventListener("click", (event) => {
    const button = event.target.closest("[data-star]");
    if (!button) return;
    highlight(Number(button.dataset.star));
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    addReview({
      name: formData.get("reviewerName") || "Client ELP",
      rating: Number(formData.get("rating")) || 5,
      comment: (formData.get("reviewComment") || "").trim() || "Merci pour votre confiance !",
    });
    clearPendingReview();
    form.reset();
    highlight(5);
  });
};

const initReviewSection = () => {
  maybeAutoReview();
  renderReviews();
  registerReviewForm();
};

const updateCartTotals = (cart = getStoredCart()) => {
  const subtotal = cart.reduce((value, item) => value + item.price * item.quantity, 0);
  const grandTotal = cart.length ? subtotal : 0;
  const subtotalEl = document.getElementById("cart-total");
  const grandTotalEl = document.getElementById("cart-grand-total");
  const checkoutTotalEl = document.getElementById("checkout-total");
  if (subtotalEl) subtotalEl.textContent = `${subtotal.toFixed(2)}€`;
  if (grandTotalEl) grandTotalEl.textContent = `${grandTotal.toFixed(2)}€`;
  if (checkoutTotalEl) checkoutTotalEl.textContent = `${grandTotal.toFixed(2)}€`;
  renderCheckoutSummary();
};

const renderCartItems = () => {
  const container = document.getElementById("cart-items");
  if (!container) return;
  const cart = getStoredCart();
  container.innerHTML = "";
  if (!cart.length) {
    container.innerHTML = '<p class="empty">Votre panier est vide.</p>';
    updateCartTotals(cart);
    return;
  }
  cart.forEach((item) => {
    const itemHTML = document.createElement("div");
    itemHTML.className = "cart-row";
    itemHTML.innerHTML = `
      <div class="cart-image">
        <img src="${item.image || "images/capture-3.avif"}" alt="${item.title}" />
      </div>
      <div>
        <h3>${item.title}</h3>
        <p>${item.price.toFixed(2)}€ par unité</p>
        <div class="cart-actions">
          <label>
            Quantité
            <input type="number" min="1" value="${item.quantity}" data-qty="${item.id}" class="qty-input" />
          </label>
          <button class="btn btn-outline small" data-remove="${item.id}">Supprimer</button>
        </div>
      </div>
      <div class="cart-price">
        <strong>${(item.price * item.quantity).toFixed(2)}€</strong>
      </div>
    `;
    container.appendChild(itemHTML);
  });
  container.querySelectorAll("[data-remove]").forEach((button) => {
    button.addEventListener("click", () => {
      removeFromCart(button.dataset.remove);
      renderCartItems();
      updateCartTotals();
      notifyCartUpdate();
    });
  });
  container.querySelectorAll("[data-qty]").forEach((input) => {
    input.addEventListener("change", (event) => {
      const value = Number(event.target.value);
      if (Number.isNaN(value) || value < 1) {
        event.target.value = 1;
        return;
      }
      updateQuantity(input.dataset.qty, value);
      renderCartItems();
      updateCartTotals();
      notifyCartUpdate();
    });
  });
  updateCartTotals(cart);
};

const updateQuantity = (id, quantity) => {
  const cart = getStoredCart();
  const found = cart.find((item) => item.id === id);
  if (found) {
    found.quantity = quantity;
    setStoredCart(cart);
  }
};

const removeFromCart = (id) => {
  const cart = getStoredCart().filter((item) => item.id !== id);
  setStoredCart(cart);
};

const clearCart = () => {
  setStoredCart([]);
  notifyCartUpdate();
  renderCartItems();
  updateCartTotals();
};

const addToCart = ({ title, price, id, image }) => {
  const cart = getStoredCart();
  const matching = cart.find((item) => item.id === id);
  if (matching) {
    matching.quantity += 1;
  } else {
    cart.push({ id, title, price, image, quantity: 1 });
  }
  setStoredCart(cart);
  updateCartTotals(cart);
  renderCartItems();
  notifyCartUpdate();
};

const handleAddButtons = () => {
  document.querySelectorAll("[data-add]").forEach((button) => {
    button.addEventListener("click", () => {
      const title = button.dataset.title || "Produit ELP";
      const price = Number(button.dataset.price) || 0;
      const id = button.dataset.id || title.toLowerCase().replace(/\s+/g, "-");
      const image = button.dataset.img || "";
      addToCart({ title, price, id, image });
    });
  });
};

const createOrderPayload = (cartItems, customer) => ({
  items: cartItems.map((item) => ({
    title: item.title,
    price: item.price,
    quantity: item.quantity,
  })),
  customer,
  success_url: `${window.location.origin}/payment-success.html`,
  cancel_url: `${window.location.origin}/payment-failed.html`,
  currency: "EUR",
});

const processStripeCheckout = async (payload) => {
  const response = await fetch(buildEndpoint("/create-checkout-session"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Erreur Stripe");
  }
  return response.json();
};

const processPayPalCheckout = async (payload) => {
  const response = await fetch(buildEndpoint("/create-paypal-order"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Erreur PayPal");
  }
  return response.json();
};

const handleCheckoutForm = () => {
  const checkoutForm = document.getElementById("checkout-form");
  if (!checkoutForm) return;
  checkoutForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const cartItems = getStoredCart();
    if (!cartItems.length) {
      alert("Ajoutez un produit avant d'entamer le paiement.");
      return;
    }
    const formData = new FormData(checkoutForm);
    const customer = {
      name: formData.get("fullName"),
      email: formData.get("email"),
      address: formData.get("address"),
      notes: formData.get("notes"),
    };
    const paymentMethod = formData.get("payment");
    const payload = createOrderPayload(cartItems, customer);
    markPendingReview(customer);
    try {
      if (paymentMethod === "paypal") {
        const result = await processPayPalCheckout(payload);
        if (result.approvalUrl) {
          window.location.href = result.approvalUrl;
        }
      } else {
        const result = await processStripeCheckout(payload);
        if (result.url) {
          window.location.href = result.url;
        }
      }
    } catch (error) {
      console.error(error);
      alert("Impossible de lancer le paiement pour le moment. Réessayez.");
    }
  });
};

const handleLoginForm = () => {
  const loginForm = document.getElementById("login-form");
  if (!loginForm) return;
  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(loginForm);
    const email = formData.get("email");
    alert(`Bienvenue sur ELP, ${email || "invité"} !`);
  });
};

const initProductSliders = () => {
  document.querySelectorAll(".product-image-slider").forEach((slider) => {
    const track = slider.querySelector(".slider-track");
    if (!track) return;
    const slides = Array.from(track.querySelectorAll(".slider-image"));
    const total = slides.length;
    if (!total) return;

    track.style.width = `${total * 100}%`;
    slides.forEach((slide) => {
      slide.style.flex = `0 0 ${100 / total}%`;
    });

    let current = 0;
    const goTo = (index) => {
      current = ((index % total) + total) % total;
      const offset = (current * 100) / total;
      track.style.transform = `translateX(-${offset}%)`;
    };

    const next = () => goTo(current + 1);
    const prev = () => goTo(current - 1);

    slider.querySelectorAll("[data-slider-prev]").forEach((button) => {
      button.addEventListener("click", () => {
        prev();
        resetAuto();
      });
    });
    slider.querySelectorAll("[data-slider-next]").forEach((button) => {
      button.addEventListener("click", () => {
        next();
        resetAuto();
      });
    });

    let autoId;
    const resetAuto = () => {
      if (autoId) clearInterval(autoId);
      autoId = setInterval(next, 4000);
    };
    slider.addEventListener("mouseenter", () => {
      clearInterval(autoId);
    });
    slider.addEventListener("mouseleave", () => {
      resetAuto();
    });
    resetAuto();
    goTo(0);
  });
};

const showLightbox = (id, index = 0) => {
  const instance = lightboxes.get(id);
  if (!instance || !instance.slides.length) return;
  instance.current = ((index % instance.slides.length) + instance.slides.length) % instance.slides.length;
  instance.update();
  instance.overlay.classList.add("active");
};

const registerLightboxes = () => {
  document.querySelectorAll(".lightbox-overlay").forEach((overlay) => {
    const id = overlay.dataset.lightboxId;
    if (!id) return;
    const track = overlay.querySelector(".lightbox-track");
    const slides = track ? Array.from(track.querySelectorAll(".lightbox-slide")) : [];
    const instance = {
      overlay,
      track,
      slides,
      current: 0,
      update() {
        if (this.track) {
          this.track.style.transform = `translateX(-${(this.current * 100) / this.slides.length}%)`;
        }
      },
    };
    if (track) {
      track.style.width = `${instance.slides.length * 100}%`;
      instance.slides.forEach((slide) => {
        slide.style.flex = `0 0 ${100 / instance.slides.length}%`;
      });
    }
    lightboxes.set(id, instance);
    overlay.querySelector("[data-lightbox-prev]")?.addEventListener("click", () => {
      instance.current = (instance.current - 1 + instance.slides.length) % instance.slides.length;
      instance.update();
    });
    overlay.querySelector("[data-lightbox-next]")?.addEventListener("click", () => {
      instance.current = (instance.current + 1) % instance.slides.length;
      instance.update();
    });
    overlay.querySelector(".lightbox-close")?.addEventListener("click", () => {
      overlay.classList.remove("active");
    });
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        overlay.classList.remove("active");
      }
    });
  });
};

const registerSliderLightboxes = () => {
  document.querySelectorAll(".product-image-slider").forEach((slider) => {
    const targetId = slider.dataset.lightboxTarget;
    if (!targetId) return;
    slider.querySelectorAll(".slider-image").forEach((slide, index) => {
      slide.addEventListener("click", () => showLightbox(targetId, index));
    });
  });
};

const initImageZoom = () => {
  if (document.getElementById("zoom-overlay")) return;
  const overlay = document.createElement("div");
  overlay.className = "zoom-overlay";
  overlay.id = "zoom-overlay";
  overlay.innerHTML = `
    <button type="button" aria-label="Fermer le zoom">×</button>
    <img alt="Zoom produit" src="" />
  `;
  document.body.appendChild(overlay);
  const zoomImg = overlay.querySelector("img");
  const closeBtn = overlay.querySelector("button");
  const showZoom = (source) => {
    zoomImg.src = source;
    overlay.classList.add("visible");
  };
  const hideZoom = () => overlay.classList.remove("visible");
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) hideZoom();
  });
  closeBtn.addEventListener("click", hideZoom);
  document.querySelectorAll(".product-image-slider .slider-image img").forEach((image) => {
    image.style.cursor = "zoom-in";
    image.addEventListener("click", () => {
      showZoom(image.src);
    });
  });
};

const initAIChatWidget = () => {
  if (document.getElementById("ai-chat-widget")) return;
  const markup = `
    <div class="ai-chat-widget" id="ai-chat-widget">
      <button type="button" class="ai-chat-toggle" aria-expanded="false">Besoin d'aide ?</button>
      <div class="ai-chat-panel" aria-hidden="true">
        <header class="ai-chat-header">
          <div>
            <strong>ELP Genius</strong>
            <p>Assistant IA 24/7 · matos, services, paiement.</p>
          </div>
          <button class="ai-chat-close" type="button" aria-label="Fermer le chat">×</button>
        </header>
        <div class="ai-chat-messages" data-ai-chat-messages></div>
        <form class="ai-chat-form">
          <input type="text" name="prompt" placeholder="Posez votre question au support ELP..." autocomplete="off" required />
          <button type="submit">Envoyer</button>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", markup);

  const widget = document.getElementById("ai-chat-widget");
  const panel = widget.querySelector(".ai-chat-panel");
  const toggle = widget.querySelector(".ai-chat-toggle");
  const close = widget.querySelector(".ai-chat-close");
  const form = widget.querySelector(".ai-chat-form");
  const input = form.querySelector("input");
  const messageList = widget.querySelector("[data-ai-chat-messages]");

  const appendMessage = (text, owner, options = {}) => {
    const message = document.createElement("div");
    message.className = `ai-chat-message ai-chat-message--${owner}${options.loading ? " loading" : ""}`;
    message.textContent = text;
    messageList.appendChild(message);
    messageList.scrollTop = messageList.scrollHeight;
    return message;
  };

  const sendMessageToAI = async (text) => {
    const typingNode = appendMessage("ELP réfléchit...", "bot", { loading: true });
    try {
      const response = await fetch(buildEndpoint("/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "La réponse IA a échoué");
      }
      typingNode.textContent = payload?.reply || "Je suis là pour vous aider.";
    } catch (error) {
      console.error("ELP AI chat", error);
      typingNode.textContent =
        "Impossible de joindre l'assistant IA pour le moment. Vous pouvez poser votre question par email.";
    } finally {
      typingNode.classList.remove("loading");
    }
  };

  const openPanel = () => {
    widget.classList.add("is-open");
    panel.setAttribute("aria-hidden", "false");
    toggle.setAttribute("aria-expanded", "true");
    input.focus();
  };

  const closePanel = () => {
    widget.classList.remove("is-open");
    panel.setAttribute("aria-hidden", "true");
    toggle.setAttribute("aria-expanded", "false");
  };

  toggle.addEventListener("click", () => {
    if (widget.classList.contains("is-open")) {
      closePanel();
    } else {
      openPanel();
    }
  });
  close.addEventListener("click", closePanel);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const question = input.value.trim();
    if (!question) return;
    appendMessage(question, "user");
    input.value = "";
    sendMessageToAI(question);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && widget.classList.contains("is-open")) {
      closePanel();
    }
  });

  appendMessage("Bonjour, je suis votre assistant ELP. Posez-moi une question sur le matériel, les services ou le paiement.", "bot");
};

document.addEventListener("DOMContentLoaded", () => {
  notifyCartUpdate();
  handleAddButtons();
  renderCartItems();
  updateCartTotals();
  handleCheckoutForm();
  handleLoginForm();
  if (document.querySelector(".payment-status.success")) {
    clearCart();
  }
  initProductSliders();
  registerLightboxes();
  registerSliderLightboxes();
  maybeAutoReview();
  initReviewSection();
  initImageZoom();
  initAIChatWidget();
});
