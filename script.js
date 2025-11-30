// API Configuration
const API_BASE_URL = "https://backend-1029.onrender.com/api";
let products = [];
let currentUser = null;
let isAdmin = false;
let authToken = null;
let cart = [];

// Get or create session ID for cart
function getSessionId() {
    let sessionId = localStorage.getItem("sessionId");
    if (!sessionId) {
        sessionId = "session_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
        localStorage.setItem("sessionId", sessionId);
    }
    return sessionId;
}

// API Helper Functions
async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
        headers: {
            "Content-Type": "application/json",
            ...options.headers,
        },
        ...options,
    };

    if (authToken) {
        config.headers.Authorization = `Bearer ${authToken}`;
    }

    try {
        const response = await fetch(url, config);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || data.error || "Request failed");
        }
        
        return data;
    } catch (error) {
        console.error("API Error:", error);
        throw error;
    }
}

// Products API
async function fetchProducts(showError = true) {
    try {
        products = await apiRequest("/products");
        return products;
    } catch (error) {
        console.error("Error fetching products:", error);
        if (showError) {
            alert("Failed to load products. Please check if the backend server is running.");
        }
        return [];
    }
}

async function createProduct(productData) {
    const formData = new FormData();
    formData.append("name", productData.name);
    formData.append("price", productData.price);
    formData.append("description", productData.description);
    formData.append("category", productData.category);
    formData.append("stock", productData.stock || 0);
    
    // Handle image - either URL or file
    const fileInput = document.getElementById("productImageFile");
    const urlInput = document.getElementById("productImage");
    
    if (fileInput && fileInput.files && fileInput.files.length > 0) {
        // File upload
        formData.append("image", fileInput.files[0]);
    } else if (urlInput && urlInput.value && urlInput.value.trim() !== "") {
        // Image URL - append as string (backend will use req.body.image when no file)
        formData.append("image", urlInput.value);
    }

    try {
        const response = await fetch(`${API_BASE_URL}/products`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${authToken}`,
                // Don't set Content-Type for FormData, browser will set it with boundary
            },
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || error.error || "Failed to create product");
        }

        const newProduct = await response.json();
        // Refresh products list immediately (don't show error if it fails silently)
        await fetchProducts(false);
        return newProduct;
    } catch (error) {
        console.error("Error creating product:", error);
        throw error;
    }
}

async function updateProduct(id, productData) {
    const formData = new FormData();
    formData.append("name", productData.name);
    formData.append("price", productData.price);
    formData.append("description", productData.description);
    formData.append("category", productData.category);
    if (productData.stock !== undefined) {
        formData.append("stock", productData.stock);
    }
    
    // Handle image - either URL or file
    const fileInput = document.getElementById("productImageFile");
    const urlInput = document.getElementById("productImage");
    
    if (fileInput && fileInput.files && fileInput.files.length > 0) {
        // File upload
        formData.append("image", fileInput.files[0]);
    } else if (urlInput && urlInput.value && urlInput.value.trim() !== "") {
        // Image URL - append as string (backend will use req.body.image when no file)
        formData.append("image", urlInput.value);
    }

    try {
        const response = await fetch(`${API_BASE_URL}/products/${id}`, {
            method: "PUT",
            headers: {
                Authorization: `Bearer ${authToken}`,
                // Don't set Content-Type for FormData, browser will set it with boundary
            },
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || error.error || "Failed to update product");
        }

        const updatedProduct = await response.json();
        // Refresh products list immediately (don't show error if it fails silently)
        await fetchProducts(false);
        return updatedProduct;
    } catch (error) {
        console.error("Error updating product:", error);
        throw error;
    }
}

async function deleteProductAPI(id) {
    try {
        await apiRequest(`/products/${id}`, { method: "DELETE" });
        return true;
    } catch (error) {
        console.error("Error deleting product:", error);
        throw error;
    }
}

// Auth API
async function loginAPI(email, password) {
    try {
        const data = await apiRequest("/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password }),
        });
        return data;
    } catch (error) {
        throw error;
    }
}

async function registerAPI(name, email, password, role = "User") {
    try {
        const data = await apiRequest("/auth/register", {
            method: "POST",
            body: JSON.stringify({ name, email, password, role }),
        });
        return data;
    } catch (error) {
        throw error;
    }
}

// DOM Elements
const loginModal = document.getElementById("loginModal");
const loginForm = document.getElementById("loginForm");
const loginLink = document.getElementById("login-link");
const logoutBtn = document.getElementById("logout-btn");
const loginNav = document.getElementById("login-nav");
const cartNav = document.getElementById("cart-nav");
const cartCount = document.getElementById("cart-count");
const adminNav = document.getElementById("admin-nav");
const logoutNav = document.getElementById("logout-nav");
const aboutNav = document.getElementById("about-nav");
const contactNav = document.getElementById("contact-nav");
const homeNav = document.getElementById("home-nav");
const productsNav = document.getElementById("products-nav");
const addProductBtn = document.getElementById("addProductBtn");
const productModal = document.getElementById("productModal");
const productForm = document.getElementById("productForm");
const modalTitle = document.getElementById("modalTitle");
const cancelBtn = document.getElementById("cancelBtn");
const contactForm = document.getElementById("contactForm");
const checkoutBtn = document.getElementById("checkout-btn");

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
    initializeNavigation();
    await loadProducts();
    setupEventListeners();
    checkAuth();
    loadCart();
    updateCartUI();
});

// Navigation
function initializeNavigation() {
    const navLinks = document.querySelectorAll(".nav-menu a[data-page]");
    navLinks.forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            const page = link.getAttribute("data-page");
            showPage(page);
        });
    });
}

async function showPage(pageName) {
    // Redirect admin away from About Us and Contact Us
    if (isAdmin && (pageName === "about" || pageName === "contact" || pageName === "home" || pageName === "products")) {
        pageName = "admin";
    }
    
    // Hide all pages
    document.querySelectorAll(".page").forEach(page => {
        page.classList.remove("active");
    });
    
    // Show selected page
    const targetPage = document.getElementById(pageName);
    if (targetPage) {
        targetPage.classList.add("active");
        
        // Load products if needed
        if (pageName === "products") {
            await loadAllProducts();
        } else if (pageName === "cart") {
            if (!currentUser || isAdmin) {
                await showPage("home");
                if (!currentUser) {
                    alert("Please login to view your cart.");
                } else {
                    alert("Admin users cannot place orders. Please login as a regular user.");
                }
                return;
            }
            loadCartPage();
        } else if (pageName === "admin") {
            if (!isAdmin) {
                await showPage("home");
                alert("Admin access required. Please login as admin.");
                return;
            }
            await loadAdminProducts();
        }
    }
}

// Product Display
async function loadProducts() {
    await fetchProducts();
    const productsGrid = document.getElementById("productsGrid");
    if (productsGrid) {
        displayProducts(products.slice(0, 8), productsGrid); // Show 8 featured products on home
    }
}

async function loadAllProducts() {
    await fetchProducts();
    const allProductsGrid = document.getElementById("allProductsGrid");
    if (allProductsGrid) {
        displayProducts(products, allProductsGrid, false);
    }
}

function displayProducts(productsToShow, container, isAdmin = false) {
    container.innerHTML = "";
    const showAddToCart = currentUser && !isAdmin;
    productsToShow.forEach(product => {
        const productCard = createProductCard(product, isAdmin, showAddToCart);
        container.appendChild(productCard);
    });
}

function createProductCard(product, isAdmin = false, showAddToCart = false) {
    const card = document.createElement("div");
    card.className = isAdmin ? "product-card admin-product-card" : "product-card";
    
    const productId = product._id || product.id;
    
    card.innerHTML = `
        <img src="${product.image}" alt="${product.name}" class="product-image" onerror="this.src='https://via.placeholder.com/300x200?text=No+Image'">
        <div class="product-info">
            <h3 class="product-name">${product.name}</h3>
            <p class="product-price">$${product.price.toFixed(2)}</p>
            <p class="product-description">${product.description}</p>
            <p class="product-category">${product.category}</p>
            ${isAdmin ? `
                <div class="admin-actions">
                    <button class="btn-edit" onclick="editProduct('${productId}')">Edit</button>
                    <button class="btn-delete" onclick="deleteProduct('${productId}')">Delete</button>
                </div>
            ` : showAddToCart ? `
                <button class="btn-add-to-cart" onclick="addToCart('${productId}')">Add to Cart</button>
            ` : ""}
        </div>
    `;
    
    return card;
}

// Admin Functions
async function loadAdminProducts() {
    await fetchProducts();
    const adminProductsGrid = document.getElementById("adminProductsGrid");
    if (adminProductsGrid) {
        displayProducts(products, adminProductsGrid, true);
    }
}

function editProduct(id) {
    const product = products.find(p => (p._id || p.id) === id);
    if (product) {
        document.getElementById("productId").value = product._id || product.id;
        document.getElementById("productName").value = product.name;
        document.getElementById("productPrice").value = product.price;
        document.getElementById("productDescription").value = product.description;
        document.getElementById("productImage").value = product.image;
        document.getElementById("productImageFile").value = "";
        document.getElementById("productCategory").value = product.category;
        modalTitle.textContent = "Edit Product";
        resetImageUploadTabs();
        if (product.image) {
            showImagePreview(product.image);
        }
        productModal.style.display = "block";
        productModal.classList.add("active");
    }
}

async function deleteProduct(id) {
    if (confirm("Are you sure you want to delete this product?")) {
        try {
            await deleteProductAPI(id);
            await loadAdminProducts();
            await loadProducts();
            await loadAllProducts();
            alert("Product deleted successfully!");
        } catch (error) {
            alert("Error deleting product: " + error.message);
        }
    }
}

// Cart Functions
function addToCart(productId) {
    if (!currentUser || isAdmin) {
        alert("Please login as a user to add items to cart.");
        return;
    }
    
    const product = products.find(p => (p._id || p.id) === productId);
    if (!product) return;
    
    const existingItem = cart.find(item => (item._id || item.id) === productId);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({ ...product, quantity: 1 });
    }
    
    saveCart();
    updateCartUI();
    alert(`${product.name} added to cart!`);
}

function removeFromCart(productId) {
    cart = cart.filter(item => (item._id || item.id) !== productId);
    saveCart();
    updateCartUI();
    loadCartPage();
}

function updateQuantity(productId, newQuantity) {
    if (newQuantity <= 0) {
        removeFromCart(productId);
        return;
    }
    
    const item = cart.find(item => (item._id || item.id) === productId);
    if (item) {
        item.quantity = parseInt(newQuantity);
        saveCart();
        updateCartUI();
        loadCartPage();
    }
}

function loadCartPage() {
    const cartItems = document.getElementById("cart-items");
    const emptyCart = document.getElementById("empty-cart");
    const cartContent = document.getElementById("cart-content");
    
    if (cart.length === 0) {
        cartContent.style.display = "none";
        emptyCart.style.display = "block";
        return;
    }
    
    cartContent.style.display = "grid";
    emptyCart.style.display = "none";
    
    cartItems.innerHTML = "";
    cart.forEach(item => {
        const itemId = item._id || item.id;
        const cartItem = document.createElement("div");
        cartItem.className = "cart-item";
        cartItem.innerHTML = `
            <img src="${item.image}" alt="${item.name}" class="cart-item-image" onerror="this.src='https://via.placeholder.com/300x200?text=No+Image'">
            <div class="cart-item-info">
                <h3 class="cart-item-name">${item.name}</h3>
                <p class="cart-item-price">$${item.price.toFixed(2)} each</p>
                <div class="cart-item-quantity">
                    <button class="quantity-btn" onclick="updateQuantity('${itemId}', ${item.quantity - 1})">-</button>
                    <input type="number" class="quantity-input" value="${item.quantity}" min="1" onchange="updateQuantity('${itemId}', this.value)">
                    <button class="quantity-btn" onclick="updateQuantity('${itemId}', ${item.quantity + 1})">+</button>
                </div>
            </div>
            <div>
                <p class="cart-item-price">$${(item.price * item.quantity).toFixed(2)}</p>
                <button class="cart-item-remove" onclick="removeFromCart('${itemId}')">Remove</button>
            </div>
        `;
        cartItems.appendChild(cartItem);
    });
    
    // Update summary
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * 0.10;
    const total = subtotal + tax;
    
    document.getElementById("cart-subtotal").textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById("cart-tax").textContent = `$${tax.toFixed(2)}`;
    document.getElementById("cart-total").textContent = `$${total.toFixed(2)}`;
}

function saveCart() {
    localStorage.setItem("cart", JSON.stringify(cart));
}

function loadCart() {
    const savedCart = localStorage.getItem("cart");
    if (savedCart) {
        cart = JSON.parse(savedCart);
    }
}

function updateCartUI() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartCount.textContent = totalItems;
    
    if (currentUser && !isAdmin) {
        cartNav.style.display = "block";
    } else {
        cartNav.style.display = "none";
    }
}

function clearCart() {
    cart = [];
    saveCart();
    updateCartUI();
}

// Event Listeners
function setupEventListeners() {
    // Login
    if (loginLink) {
        loginLink.addEventListener("click", (e) => {
            e.preventDefault();
            loginModal.style.display = "block";
            loginModal.classList.add("active");
            setTimeout(() => switchAuthTab("login"), 10);
        });
    }
    
    loginForm.addEventListener("submit", handleLogin);
    
    // Registration Form
    const registerForm = document.getElementById("registerForm");
    if (registerForm) {
        registerForm.addEventListener("submit", handleRegister);
    }
    
    // Auth Tab Switching
    document.querySelectorAll(".auth-tab").forEach(tab => {
        tab.addEventListener("click", () => {
            const tabType = tab.getAttribute("data-tab");
            switchAuthTab(tabType);
        });
    });
    
    // Logout
    logoutBtn.addEventListener("click", (e) => {
        e.preventDefault();
        handleLogout();
    });
    
    // Close modals
    document.querySelectorAll(".close").forEach(closeBtn => {
        closeBtn.addEventListener("click", (e) => {
            const modal = e.target.closest(".modal");
            if (modal) {
                modal.style.display = "none";
                if (modal.id === "productModal") {
                    clearImagePreview();
                    resetImageUploadTabs();
                    modal.classList.remove("active");
                } else if (modal.id === "loginModal") {
                    // Reset to login tab when closing
                    switchAuthTab("login");
                    document.getElementById("loginForm").reset();
                    document.getElementById("registerForm").reset();
                    document.getElementById("loginError").classList.remove("show");
                    document.getElementById("registerError").classList.remove("show");
                    modal.classList.remove("active");
                }
            }
        });
    });
    
    window.addEventListener("click", (e) => {
        if (e.target === loginModal) {
            loginModal.style.display = "none";
            loginModal.classList.remove("active");
            switchAuthTab("login");
            document.getElementById("loginForm").reset();
            document.getElementById("registerForm").reset();
            document.getElementById("loginError").classList.remove("show");
            document.getElementById("registerError").classList.remove("show");
        }
        if (e.target === productModal) {
            productModal.style.display = "none";
            productModal.classList.remove("active");
            clearImagePreview();
            resetImageUploadTabs();
        }
    });
    
    // Add Product
    addProductBtn.addEventListener("click", () => {
        productForm.reset();
        document.getElementById("productId").value = "";
        modalTitle.textContent = "Add New Product";
        clearImagePreview();
        resetImageUploadTabs();
        productModal.style.display = "block";
        productModal.classList.add("active");
    });
    
    // Image Upload Tab Switching
    document.querySelectorAll(".upload-tab").forEach(tab => {
        tab.addEventListener("click", () => {
            const tabType = tab.getAttribute("data-tab");
            switchImageUploadTab(tabType);
        });
    });
    
    // Image URL input change
    const productImageInput = document.getElementById("productImage");
    if (productImageInput) {
        productImageInput.addEventListener("input", (e) => {
            const url = e.target.value;
            if (url && isValidUrl(url)) {
                showImagePreview(url);
            } else {
                clearImagePreview();
            }
        });
    }
    
    // Image File input change
    const productImageFile = document.getElementById("productImageFile");
    if (productImageFile) {
        productImageFile.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (file) {
                if (file.size > 5 * 1024 * 1024) {
                    alert("File size must be less than 5MB");
                    e.target.value = "";
                    clearImagePreview();
                    return;
                }
                const reader = new FileReader();
                reader.onload = (event) => {
                    showImagePreview(event.target.result);
                };
                reader.readAsDataURL(file);
            } else {
                clearImagePreview();
            }
        });
    }
    
    // Product Form
    productForm.addEventListener("submit", handleProductSubmit);
    
    cancelBtn.addEventListener("click", () => {
        productModal.style.display = "none";
        productModal.classList.remove("active");
        clearImagePreview();
        resetImageUploadTabs();
    });
    
    // Contact Form
    if (contactForm) {
        contactForm.addEventListener("submit", (e) => {
            e.preventDefault();
            alert("Thank you for your message! We will get back to you soon.");
            contactForm.reset();
        });
    }
    
    // Checkout
    if (checkoutBtn) {
        checkoutBtn.addEventListener("click", () => {
            if (cart.length === 0) {
                alert("Your cart is empty!");
                return;
            }
            
            const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0) * 1.10;
            if (confirm(`Proceed with checkout? Total: $${total.toFixed(2)}`)) {
                alert("Order placed successfully! Thank you for your purchase.");
                clearCart();
                showPage("home");
            }
        });
    }
}

// Authentication
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById("username").value; // Using email as username
    const password = document.getElementById("password").value;
    const errorMsg = document.getElementById("loginError");
    
    try {
        const data = await loginAPI(email, password);
        authToken = data.token;
        currentUser = data.user;
        isAdmin = currentUser.role === "Admin";
        
        // Store token and user info
        localStorage.setItem("authToken", authToken);
        localStorage.setItem("currentUser", JSON.stringify(currentUser));
        
        errorMsg.classList.remove("show");
        loginModal.style.display = "none";
        loginModal.classList.remove("active");
        loginForm.reset();
        updateAuthUI();
        if (isAdmin) {
            showPage("admin");
        }
        alert(`Welcome, ${currentUser.name || email}!`);
    } catch (error) {
        errorMsg.textContent = error.message || "Invalid email or password";
        errorMsg.classList.add("show");
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById("registerName").value;
    const email = document.getElementById("registerEmail").value;
    const password = document.getElementById("registerPassword").value;
    const confirmPassword = document.getElementById("registerConfirmPassword").value;
    const errorMsg = document.getElementById("registerError");
    
    // Validation
    if (password !== confirmPassword) {
        errorMsg.textContent = "Passwords do not match";
        errorMsg.classList.add("show");
        return;
    }
    
    if (password.length < 6) {
        errorMsg.textContent = "Password must be at least 6 characters";
        errorMsg.classList.add("show");
        return;
    }
    
    try {
        const data = await registerAPI(name, email, password, "User");
        authToken = data.token;
        currentUser = data.user;
        isAdmin = false; // New registrations are always Users
        
        // Store token and user info
        localStorage.setItem("authToken", authToken);
        localStorage.setItem("currentUser", JSON.stringify(currentUser));
        
        errorMsg.classList.remove("show");
        loginModal.style.display = "none";
        loginModal.classList.remove("active");
        document.getElementById("registerForm").reset();
        updateAuthUI();
        alert(`Account created successfully! Welcome, ${name}!`);
    } catch (error) {
        errorMsg.textContent = error.message || "Registration failed. Email may already be in use.";
        errorMsg.classList.add("show");
    }
}

function switchAuthTab(tabType) {
    document.querySelectorAll(".auth-tab").forEach(tab => {
        tab.classList.remove("active");
    });
    document.querySelectorAll(".auth-panel").forEach(panel => {
        panel.classList.remove("active");
    });
    
    document.querySelector(`.auth-tab[data-tab="${tabType}"]`).classList.add("active");
    document.getElementById(`${tabType}FormPanel`).classList.add("active");
    
    // Clear errors
    document.getElementById("loginError").classList.remove("show");
    document.getElementById("registerError").classList.remove("show");
}

function handleLogout() {
    currentUser = null;
    isAdmin = false;
    authToken = null;
    localStorage.removeItem("authToken");
    localStorage.removeItem("currentUser");
    clearCart();
    updateAuthUI();
    showPage("home");
    alert("You have been logged out.");
}

function checkAuth() {
    // Check if user is already logged in (from localStorage)
    const savedToken = localStorage.getItem("authToken");
    const savedUser = localStorage.getItem("currentUser");
    if (savedToken && savedUser) {
        authToken = savedToken;
        const user = JSON.parse(savedUser);
        currentUser = user;
        isAdmin = user.role === "Admin";
        updateAuthUI();
    }
}

function updateAuthUI() {
    const userInfo = document.getElementById("user-info");
    const userName = document.getElementById("user-name");
    const userBadge = document.getElementById("user-badge");
    
    if (currentUser) {
        loginNav.style.display = "none";
        logoutNav.style.display = "block";
        userInfo.style.display = "flex";
        
        // Display user name
        if (userName) {
            userName.textContent = currentUser.name || currentUser.email || "User";
        }
        
        // Display badge for admin
        if (userBadge) {
            if (isAdmin) {
                userBadge.textContent = "ADMIN";
                userBadge.className = "user-badge admin-badge";
            } else {
                userBadge.textContent = "USER";
                userBadge.className = "user-badge user-badge-style";
            }
        }
        
        if (isAdmin) {
            // Admin: Hide About Us, Contact Us, Home, Products, Cart
            // Show only Admin link
            adminNav.style.display = "block";
            cartNav.style.display = "none";
            aboutNav.style.display = "none";
            contactNav.style.display = "none";
            homeNav.style.display = "none";
            productsNav.style.display = "none";
        } else {
            // User: Show all navigation except Admin
            adminNav.style.display = "none";
            cartNav.style.display = "block";
            aboutNav.style.display = "block";
            contactNav.style.display = "block";
            homeNav.style.display = "block";
            productsNav.style.display = "block";
        }
    } else {
        // Not logged in: Show all navigation except Admin and Cart
        loginNav.style.display = "block";
        logoutNav.style.display = "none";
        adminNav.style.display = "none";
        cartNav.style.display = "none";
        userInfo.style.display = "none";
        aboutNav.style.display = "block";
        contactNav.style.display = "block";
        homeNav.style.display = "block";
        productsNav.style.display = "block";
    }
    updateCartUI();
    // Reload products to show/hide add to cart buttons
    loadProducts();
    loadAllProducts();
}

// Image Upload Functions
function switchImageUploadTab(tabType) {
    document.querySelectorAll(".upload-tab").forEach(tab => {
        tab.classList.remove("active");
    });
    document.querySelectorAll(".upload-panel").forEach(panel => {
        panel.classList.remove("active");
    });
    
    document.querySelector(`.upload-tab[data-tab="${tabType}"]`).classList.add("active");
    document.getElementById(`${tabType}-upload`).classList.add("active");
    
    // Clear the other input
    if (tabType === "url") {
        document.getElementById("productImageFile").value = "";
    } else {
        document.getElementById("productImage").value = "";
    }
}

function resetImageUploadTabs() {
    switchImageUploadTab("url");
    clearImagePreview();
}

function showImagePreview(imageSrc) {
    const preview = document.getElementById("imagePreview");
    const previewImg = document.getElementById("previewImg");
    if (preview && previewImg) {
        previewImg.src = imageSrc;
        preview.style.display = "block";
    }
}

function clearImagePreview() {
    const preview = document.getElementById("imagePreview");
    const previewImg = document.getElementById("previewImg");
    if (preview) {
        preview.style.display = "none";
    }
    if (previewImg) {
        previewImg.src = "";
    }
}

function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

function getImageSource() {
    return new Promise((resolve) => {
        const fileInput = document.getElementById("productImageFile");
        const urlInput = document.getElementById("productImage");
        
        // Check if file is uploaded
        if (fileInput && fileInput.files && fileInput.files.length > 0) {
            const reader = new FileReader();
            reader.onload = (event) => {
                resolve(event.target.result);
            };
            reader.onerror = () => {
                resolve("");
            };
            reader.readAsDataURL(fileInput.files[0]);
        } else if (urlInput && urlInput.value) {
            // Use URL
            resolve(urlInput.value);
        } else {
            resolve("");
        }
    });
}

// Product CRUD
async function handleProductSubmit(e) {
    e.preventDefault();
    
    const id = document.getElementById("productId").value;
    const name = document.getElementById("productName").value;
    const price = parseFloat(document.getElementById("productPrice").value);
    const description = document.getElementById("productDescription").value;
    const category = document.getElementById("productCategory").value;
    
    // Get image from either URL or file upload
    const image = await getImageSource();
    
    if (!image && !document.getElementById("productImageFile").files.length) {
        alert("Please provide an image URL or upload an image file.");
        return;
    }
    
    try {
        const productData = {
            name,
            price,
            description,
            category,
            stock: 0, // Default stock
            image: image || undefined
        };
        
        if (id) {
            // Update existing product
            await updateProduct(id, productData);
            alert("Product updated successfully!");
        } else {
            // Create new product
            await createProduct(productData);
            alert("Product added successfully!");
        }
        
        productModal.style.display = "none";
        productModal.classList.remove("active");
        productForm.reset();
        clearImagePreview();
        resetImageUploadTabs();
        
        // Force refresh products from backend (silently, don't show errors)
        await fetchProducts(false);
        await loadAdminProducts();
        await loadProducts();
        await loadAllProducts();
    } catch (error) {
        alert("Error saving product: " + error.message);
    }
}

// Make functions globally accessible
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.updateQuantity = updateQuantity;
window.clearImagePreview = clearImagePreview;

