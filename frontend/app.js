// ML Ecosystem Frontend - Microservices Edition
class MLStockMonitor {
    constructor() {
        this.apiBaseUrls = {
            user: 'http://localhost:3001',
            integration: 'http://localhost:3002',
            mlApi: 'http://localhost:3333'
        };
        
        this.products = [];
        this.currentUser = { email: 'demo@example.com', name: 'Demo User' };
        
        this.init();
    }

    async init() {
        console.log('🚀 Iniciando ML Stock Monitor Frontend...');
        
        // Check microservices status
        await this.checkMicroservicesStatus();
        
        // Load initial data
        await this.loadStats();
        await this.loadProducts();
        
        console.log('✅ Frontend inicializado correctamente');
    }

    async checkMicroservicesStatus() {
        const services = [
            { name: 'userServiceStatus', url: this.apiBaseUrls.user + '/health' },
            { name: 'integrationServiceStatus', url: this.apiBaseUrls.integration + '/health' },
            { name: 'mlApiStatus', url: this.apiBaseUrls.mlApi + '/health' }
        ];

        for (const service of services) {
            try {
                console.log(`Checking service: ${service.url}`);
                const response = await fetch(service.url, {
                    method: 'GET',
                    mode: 'cors',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                });
                
                console.log(`Service ${service.name} response:`, response.status, response.ok);
                
                const status = response.ok ? 'status-healthy' : 'status-warning';
                const element = document.getElementById(service.name);
                if (element) {
                    element.className = `status-indicator ${status}`;
                }
            } catch (error) {
                console.error(`Service ${service.name} error:`, error);
                const element = document.getElementById(service.name);
                if (element) {
                    element.className = 'status-indicator status-error';
                }
            }
        }
    }

    async loadStats() {
        try {
            // Get user count
            const usersResponse = await fetch(`${this.apiBaseUrls.user}/api/users`);
            const usersData = await usersResponse.json();
            
            document.getElementById('totalUsers').textContent = usersData.total || 0;
            document.getElementById('totalProducts').textContent = this.products.length;
            
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    async loadProducts() {
        const container = document.getElementById('productsContainer');
        const spinner = document.getElementById('loadingSpinner');
        const emptyState = document.getElementById('emptyState');
        
        // Show loading
        spinner.style.display = 'block';
        container.innerHTML = '';
        emptyState.style.display = 'none';

        try {
            // Simulate loading products from microservices
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Mock products data (simulating data from ML API via microservices)
            this.products = [
                {
                    id: 'MLA123456789',
                    title: 'iPhone 14 Pro Max 256GB Space Black',
                    price: 899999.99,
                    currency: 'ARS',
                    available_quantity: 5,
                    condition: 'new',
                    category_id: 'MLA1055',
                    thumbnail: 'https://http2.mlstatic.com/D_Q_NP_639326-MLA69651551077_052023-V.webp',
                    permalink: 'https://articulo.mercadolibre.com.ar/MLA123456789',
                    seller: { nickname: 'DEMOSELLER' },
                    shipping: { free_shipping: true },
                    tags: ['good_quality_picture', 'brand_verified']
                },
                {
                    id: 'MLA987654321',
                    title: 'Samsung Galaxy S23 Ultra 256GB Phantom Black',
                    price: 749999.99,
                    currency: 'ARS',
                    available_quantity: 3,
                    condition: 'new',
                    category_id: 'MLA1055',
                    thumbnail: 'https://http2.mlstatic.com/D_Q_NP_968414-MLA69651551078_052023-V.webp',
                    permalink: 'https://articulo.mercadolibre.com.ar/MLA987654321',
                    seller: { nickname: 'DEMOSELLER' },
                    shipping: { free_shipping: true },
                    tags: ['immediate_payment']
                },
                {
                    id: 'MLA555666777',
                    title: 'MacBook Pro M2 13 pulgadas 256GB Space Gray',
                    price: 1299999.99,
                    currency: 'ARS',
                    available_quantity: 2,
                    condition: 'new',
                    category_id: 'MLA1648',
                    thumbnail: 'https://http2.mlstatic.com/D_Q_NP_744308-MLA69651551079_052023-V.webp',
                    permalink: 'https://articulo.mercadolibre.com.ar/MLA555666777',
                    seller: { nickname: 'TESTSELLER' },
                    shipping: { free_shipping: true },
                    tags: ['brand_verified', 'good_quality_picture']
                },
                {
                    id: 'MLA111222333',
                    title: 'iPad Air 5ta generación 64GB WiFi',
                    price: 549999.99,
                    currency: 'ARS',
                    available_quantity: 8,
                    condition: 'new',
                    category_id: 'MLA1648',
                    thumbnail: 'https://http2.mlstatic.com/D_Q_NP_855432-MLA69651551080_052023-V.webp',
                    permalink: 'https://articulo.mercadolibre.com.ar/MLA111222333',
                    seller: { nickname: 'TESTSELLER' },
                    shipping: { free_shipping: false },
                    tags: ['good_quality_picture']
                },
                {
                    id: 'MLA444555666',
                    title: 'Zapatillas Nike Air Max 270 Originales',
                    price: 89999.99,
                    currency: 'ARS',
                    available_quantity: 15,
                    condition: 'new',
                    category_id: 'MLA1276',
                    thumbnail: 'https://http2.mlstatic.com/D_Q_NP_612345-MLA69651551081_052023-V.webp',
                    permalink: 'https://articulo.mercadolibre.com.ar/MLA444555666',
                    seller: { nickname: 'SPORTSELLER' },
                    shipping: { free_shipping: true },
                    tags: ['brand_verified']
                }
            ];

            this.renderProducts(this.products);
            await this.loadStats();

        } catch (error) {
            console.error('Error loading products:', error);
            this.showError('Error cargando productos desde microservicios');
        } finally {
            spinner.style.display = 'none';
        }
    }

    renderProducts(products) {
        const container = document.getElementById('productsContainer');
        const emptyState = document.getElementById('emptyState');
        
        if (products.length === 0) {
            container.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';
        
        container.innerHTML = products.map(product => `
            <div class="col-md-6 col-lg-4 mb-4">
                <div class="card product-card h-100" onclick="showProductDetails('${product.id}')">
                    <div class="position-relative">
                        <img src="${product.thumbnail}" class="card-img-top" alt="${product.title}" 
                             style="height: 200px; object-fit: cover;">
                        <span class="badge ${this.getStockBadgeClass(product.available_quantity)} stock-badge">
                            Stock: ${product.available_quantity}
                        </span>
                    </div>
                    <div class="card-body d-flex flex-column">
                        <h6 class="card-title" title="${product.title}">
                            ${product.title.length > 60 ? product.title.substring(0, 60) + '...' : product.title}
                        </h6>
                        <div class="mt-auto">
                            <div class="ml-price mb-2">
                                $ ${this.formatPrice(product.price)}
                            </div>
                            <div class="d-flex justify-content-between align-items-center">
                                <small class="text-muted">
                                    <i class="fas fa-store"></i> ${product.seller.nickname}
                                </small>
                                ${product.shipping.free_shipping ? 
                                    '<span class="badge bg-success">Envío gratis</span>' : 
                                    '<span class="badge bg-secondary">Envío con costo</span>'
                                }
                            </div>
                            <div class="mt-2">
                                ${product.tags.includes('brand_verified') ? 
                                    '<span class="badge bg-primary me-1">Marca verificada</span>' : ''
                                }
                                ${product.condition === 'new' ? 
                                    '<span class="badge bg-info">Nuevo</span>' : 
                                    '<span class="badge bg-warning">Usado</span>'
                                }
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    getStockBadgeClass(quantity) {
        if (quantity === 0) return 'bg-danger';
        if (quantity < 5) return 'bg-warning';
        return 'bg-success';
    }

    formatPrice(price) {
        return new Intl.NumberFormat('es-AR').format(price);
    }

    searchProducts() {
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        const categoryFilter = document.getElementById('categoryFilter').value;
        
        let filteredProducts = this.products.filter(product => {
            const matchesSearch = product.title.toLowerCase().includes(searchTerm);
            const matchesCategory = !categoryFilter || product.category_id === categoryFilter;
            return matchesSearch && matchesCategory;
        });

        this.renderProducts(filteredProducts);
    }

    filterByCategory() {
        this.searchProducts(); // Reuse search logic
    }

    showProductDetails(productId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) return;

        const modal = new bootstrap.Modal(document.getElementById('productModal'));
        
        document.getElementById('modalProductTitle').textContent = product.title;
        document.getElementById('modalProductBody').innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <img src="${product.thumbnail}" class="img-fluid rounded" alt="${product.title}">
                </div>
                <div class="col-md-6">
                    <h5 class="ml-price">$ ${this.formatPrice(product.price)}</h5>
                    <p class="text-muted mb-3">ID: ${product.id}</p>
                    
                    <div class="mb-3">
                        <strong>Stock disponible:</strong> 
                        <span class="badge ${this.getStockBadgeClass(product.available_quantity)}">
                            ${product.available_quantity} unidades
                        </span>
                    </div>
                    
                    <div class="mb-3">
                        <strong>Condición:</strong> 
                        <span class="badge ${product.condition === 'new' ? 'bg-info' : 'bg-warning'}">
                            ${product.condition === 'new' ? 'Nuevo' : 'Usado'}
                        </span>
                    </div>
                    
                    <div class="mb-3">
                        <strong>Vendedor:</strong> ${product.seller.nickname}
                    </div>
                    
                    <div class="mb-3">
                        <strong>Envío:</strong> 
                        ${product.shipping.free_shipping ? 
                            '<span class="text-success"><i class="fas fa-check"></i> Gratis</span>' : 
                            '<span class="text-warning"><i class="fas fa-truck"></i> Con costo</span>'
                        }
                    </div>
                    
                    <div class="mb-3">
                        <a href="${product.permalink}" target="_blank" class="btn btn-outline-primary">
                            <i class="fas fa-external-link-alt"></i> Ver en MercadoLibre
                        </a>
                    </div>
                </div>
            </div>
        `;
        
        // Store current product for monitoring
        window.currentModalProduct = product;
        
        modal.show();
    }

    async monitorProduct() {
        const product = window.currentModalProduct;
        if (!product) return;

        try {
            // Simulate adding product to monitoring via microservices
            const response = await fetch(`${this.apiBaseUrls.integration}/api/monitor`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    product_id: product.id,
                    user_email: this.currentUser.email,
                    alerts: {
                        price_change: true,
                        stock_low: true,
                        stock_out: true
                    }
                })
            });

            if (response.ok) {
                this.showSuccess(`Producto ${product.title} agregado al monitoreo`);
                bootstrap.Modal.getInstance(document.getElementById('productModal')).hide();
            } else {
                this.showError('Error agregando producto al monitoreo');
            }
        } catch (error) {
            // For demo purposes, show success anyway
            this.showSuccess(`Producto ${product.title} agregado al monitoreo (modo demo)`);
            bootstrap.Modal.getInstance(document.getElementById('productModal')).hide();
        }
    }

    showSuccess(message) {
        this.showAlert(message, 'success');
    }

    showError(message) {
        this.showAlert(message, 'danger');
    }

    showAlert(message, type) {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
        alertDiv.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(alertDiv);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
    }

    logout() {
        if (confirm('¿Estás seguro que quieres cerrar sesión?')) {
            // In a real app, would call logout API
            alert('Sesión cerrada (modo demo)');
        }
    }
}

// Global functions for HTML onclick handlers
function searchProducts() {
    window.mlApp.searchProducts();
}

function filterByCategory() {
    window.mlApp.filterByCategory();
}

function loadProducts() {
    window.mlApp.loadProducts();
}

function showProductDetails(productId) {
    window.mlApp.showProductDetails(productId);
}

function monitorProduct() {
    window.mlApp.monitorProduct();
}

function logout() {
    window.mlApp.logout();
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.mlApp = new MLStockMonitor();
});