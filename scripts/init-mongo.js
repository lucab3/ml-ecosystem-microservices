// ML Ecosystem - MongoDB Initialization Script
// Initialize MongoDB with test data for catalog service

// Switch to the ml_ecosystem database
db = db.getSiblingDB('ml_ecosystem');

// Create collections
db.createCollection('categories');
db.createCollection('products_catalog');
db.createCollection('search_history');
db.createCollection('user_preferences');

// Insert ML categories (based on real MercadoLibre categories)
db.categories.insertMany([
    {
        _id: 'MLA1055',
        name: 'Celulares y Teléfonos',
        path_from_root: [
            { id: 'MLA1000', name: 'Electrónicos, Audio y Video' },
            { id: 'MLA1055', name: 'Celulares y Teléfonos' }
        ],
        total_items: 125000,
        permalink: 'https://listado.mercadolibre.com.ar/celulares-telefones',
        picture: 'https://http2.mlstatic.com/resources/frontend/statics/growth-sellers-landings/device-celulares-category.png',
        attributes: [
            { id: 'BRAND', name: 'Marca' },
            { id: 'MODEL', name: 'Modelo' },
            { id: 'STORAGE_CAPACITY', name: 'Capacidad de almacenamiento' },
            { id: 'RAM_MEMORY', name: 'Memoria RAM' }
        ],
        created_at: new Date(),
        updated_at: new Date()
    },
    {
        _id: 'MLA1648',
        name: 'Computación',
        path_from_root: [
            { id: 'MLA1000', name: 'Electrónicos, Audio y Video' },
            { id: 'MLA1648', name: 'Computación' }
        ],
        total_items: 89000,
        permalink: 'https://listado.mercadolibre.com.ar/computacion',
        picture: 'https://http2.mlstatic.com/resources/frontend/statics/growth-sellers-landings/device-computacion-category.png',
        attributes: [
            { id: 'BRAND', name: 'Marca' },
            { id: 'MODEL', name: 'Modelo' },
            { id: 'PROCESSOR_MODEL', name: 'Modelo del procesador' },
            { id: 'RAM_MEMORY', name: 'Memoria RAM' }
        ],
        created_at: new Date(),
        updated_at: new Date()
    },
    {
        _id: 'MLA1276',
        name: 'Deportes y Fitness',
        path_from_root: [
            { id: 'MLA1276', name: 'Deportes y Fitness' }
        ],
        total_items: 67000,
        permalink: 'https://listado.mercadolibre.com.ar/deportes-fitness',
        picture: 'https://http2.mlstatic.com/resources/frontend/statics/growth-sellers-landings/device-deportes-category.png',
        attributes: [
            { id: 'BRAND', name: 'Marca' },
            { id: 'SPORT_TYPE', name: 'Tipo de deporte' },
            { id: 'SIZE', name: 'Talle' }
        ],
        created_at: new Date(),
        updated_at: new Date()
    }
]);

// Insert test products for catalog
db.products_catalog.insertMany([
    {
        _id: 'MLA123456789',
        ml_item_id: 'MLA123456789',
        title: 'iPhone 14 Pro Max 256GB Space Black',
        category_id: 'MLA1055',
        seller_id: '123456789',
        price: 899999.99,
        currency_id: 'ARS',
        available_quantity: 5,
        condition: 'new',
        listing_type_id: 'gold_special',
        permalink: 'https://articulo.mercadolibre.com.ar/MLA123456789',
        thumbnail: 'https://http2.mlstatic.com/D_Q_NP_123456-MLA123456789_iPhone14ProMax.webp',
        pictures: [
            { id: 'pic1', url: 'https://http2.mlstatic.com/D_Q_NP_123456-MLA123456789_iPhone14ProMax.webp' },
            { id: 'pic2', url: 'https://http2.mlstatic.com/D_Q_NP_789012-MLA123456789_iPhone14ProMax_back.webp' }
        ],
        attributes: [
            { id: 'BRAND', name: 'Marca', value_name: 'Apple' },
            { id: 'MODEL', name: 'Modelo', value_name: 'iPhone 14 Pro Max' },
            { id: 'STORAGE_CAPACITY', name: 'Capacidad de almacenamiento', value_name: '256 GB' },
            { id: 'RAM_MEMORY', name: 'Memoria RAM', value_name: '6 GB' },
            { id: 'COLOR', name: 'Color', value_name: 'Space Black' }
        ],
        shipping: {
            free_shipping: true,
            mode: 'me2',
            logistic_type: 'fulfillment'
        },
        tags: ['good_quality_picture', 'good_quality_thumbnail', 'brand_verified'],
        catalog_product_id: 'MLA15037616',
        domain_id: 'MLA-CELLPHONES',
        parent_item_id: null,
        differential_pricing: null,
        sale_terms: [
            { id: 'WARRANTY_TYPE', name: 'Tipo de garantía', value_name: 'Garantía del vendedor' },
            { id: 'WARRANTY_TIME', name: 'Tiempo de garantía', value_name: '12 meses' }
        ],
        last_sync: new Date(),
        created_at: new Date(),
        updated_at: new Date()
    },
    {
        _id: 'MLA987654321',
        ml_item_id: 'MLA987654321',
        title: 'Samsung Galaxy S23 Ultra 256GB Phantom Black',
        category_id: 'MLA1055',
        seller_id: '123456789',
        price: 749999.99,
        currency_id: 'ARS',
        available_quantity: 3,
        condition: 'new',
        listing_type_id: 'gold_special',
        permalink: 'https://articulo.mercadolibre.com.ar/MLA987654321',
        thumbnail: 'https://http2.mlstatic.com/D_Q_NP_987654-MLA987654321_GalaxyS23Ultra.webp',
        pictures: [
            { id: 'pic1', url: 'https://http2.mlstatic.com/D_Q_NP_987654-MLA987654321_GalaxyS23Ultra.webp' }
        ],
        attributes: [
            { id: 'BRAND', name: 'Marca', value_name: 'Samsung' },
            { id: 'MODEL', name: 'Modelo', value_name: 'Galaxy S23 Ultra' },
            { id: 'STORAGE_CAPACITY', name: 'Capacidad de almacenamiento', value_name: '256 GB' },
            { id: 'RAM_MEMORY', name: 'Memoria RAM', value_name: '12 GB' },
            { id: 'COLOR', name: 'Color', value_name: 'Phantom Black' }
        ],
        shipping: {
            free_shipping: true,
            mode: 'me2',
            logistic_type: 'cross_docking'
        },
        tags: ['good_quality_picture', 'immediate_payment'],
        catalog_product_id: 'MLA18951259',
        domain_id: 'MLA-CELLPHONES',
        last_sync: new Date(),
        created_at: new Date(),
        updated_at: new Date()
    },
    {
        _id: 'MLA555666777',
        ml_item_id: 'MLA555666777',
        title: 'MacBook Pro M2 13 pulgadas 256GB Space Gray',
        category_id: 'MLA1648',
        seller_id: '987654321',
        price: 1299999.99,
        currency_id: 'ARS',
        available_quantity: 2,
        condition: 'new',
        listing_type_id: 'gold_pro',
        permalink: 'https://articulo.mercadolibre.com.ar/MLA555666777',
        thumbnail: 'https://http2.mlstatic.com/D_Q_NP_555666-MLA555666777_MacBookPro.webp',
        pictures: [
            { id: 'pic1', url: 'https://http2.mlstatic.com/D_Q_NP_555666-MLA555666777_MacBookPro.webp' }
        ],
        attributes: [
            { id: 'BRAND', name: 'Marca', value_name: 'Apple' },
            { id: 'MODEL', name: 'Modelo', value_name: 'MacBook Pro' },
            { id: 'PROCESSOR_MODEL', name: 'Modelo del procesador', value_name: 'Apple M2' },
            { id: 'RAM_MEMORY', name: 'Memoria RAM', value_name: '8 GB' },
            { id: 'STORAGE_CAPACITY', name: 'Capacidad de almacenamiento', value_name: '256 GB SSD' },
            { id: 'SCREEN_SIZE', name: 'Tamaño de pantalla', value_name: '13.3 "' }
        ],
        shipping: {
            free_shipping: true,
            mode: 'me2',
            logistic_type: 'fulfillment'
        },
        tags: ['brand_verified', 'good_quality_picture'],
        catalog_product_id: 'MLA19283745',
        domain_id: 'MLA-NOTEBOOKS',
        last_sync: new Date(),
        created_at: new Date(),
        updated_at: new Date()
    }
]);

// Insert search history test data
db.search_history.insertMany([
    {
        user_id: '1',
        query: 'iphone 14',
        category_id: 'MLA1055',
        results_count: 1250,
        clicked_items: ['MLA123456789'],
        search_date: new Date(),
        ip_address: '192.168.1.100'
    },
    {
        user_id: '1',
        query: 'macbook pro m2',
        category_id: 'MLA1648',
        results_count: 89,
        clicked_items: ['MLA555666777'],
        search_date: new Date(),
        ip_address: '192.168.1.100'
    },
    {
        user_id: '2',
        query: 'samsung galaxy s23',
        category_id: 'MLA1055',
        results_count: 342,
        clicked_items: ['MLA987654321'],
        search_date: new Date(),
        ip_address: '192.168.1.101'
    }
]);

// Insert user preferences
db.user_preferences.insertMany([
    {
        user_id: '1',
        preferred_categories: ['MLA1055', 'MLA1648'],
        price_range: { min: 100000, max: 2000000 },
        shipping_preferences: {
            free_shipping_only: true,
            same_day_delivery: false
        },
        notification_settings: {
            price_drops: true,
            new_listings: true,
            low_stock_alerts: true
        },
        created_at: new Date(),
        updated_at: new Date()
    },
    {
        user_id: '2',
        preferred_categories: ['MLA1648', 'MLA1276'],
        price_range: { min: 50000, max: 1500000 },
        shipping_preferences: {
            free_shipping_only: false,
            same_day_delivery: true
        },
        notification_settings: {
            price_drops: true,
            new_listings: false,
            low_stock_alerts: true
        },
        created_at: new Date(),
        updated_at: new Date()
    }
]);

// Create indexes for performance
db.categories.createIndex({ "name": 1 });
db.categories.createIndex({ "path_from_root.id": 1 });

db.products_catalog.createIndex({ "ml_item_id": 1 }, { unique: true });
db.products_catalog.createIndex({ "seller_id": 1 });
db.products_catalog.createIndex({ "category_id": 1 });
db.products_catalog.createIndex({ "price": 1 });
db.products_catalog.createIndex({ "available_quantity": 1 });
db.products_catalog.createIndex({ "last_sync": 1 });
db.products_catalog.createIndex({ "title": "text" });

db.search_history.createIndex({ "user_id": 1 });
db.search_history.createIndex({ "search_date": -1 });
db.search_history.createIndex({ "query": "text" });

db.user_preferences.createIndex({ "user_id": 1 }, { unique: true });

// Print success message
print('MongoDB initialized successfully!');
print('Collections created: categories, products_catalog, search_history, user_preferences');
print('Test data inserted for 3 products and user preferences');
print('Indexes created for optimal performance');