const products = [
  {
    id: "linen-everyday-shirt", name: "Linen Everyday Shirt", category: "Clothing",
    description: "An easy, breathable everyday layer with a relaxed cut and a soft, lived-in feel. Designed to work across seasons.",
    price: 4850, stock: 24, image_url: "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=1000&q=85", featured: 1
  },
  {
    id: "structured-weekend-tote", name: "Structured Weekend Tote", category: "Accessories",
    description: "A clean-lined carryall for busy days, short trips and everything that comes in between.",
    price: 3950, stock: 18, image_url: "https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=1000&q=85", featured: 1
  },
  {
    id: "everyday-knit", name: "Everyday Knit", category: "Clothing",
    description: "A tactile knit with a considered silhouette. Easy to layer and made to feel familiar from the first wear.",
    price: 6200, stock: 16, image_url: "https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=1000&q=85", featured: 1
  },
  {
    id: "soft-form-crossbody", name: "Soft Form Crossbody", category: "Accessories",
    description: "A compact, versatile bag with simple details and room for the daily essentials.",
    price: 5400, stock: 12, image_url: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1000&q=85", featured: 1
  },
  {
    id: "cotton-relaxed-trousers", name: "Cotton Relaxed Trousers", category: "Clothing",
    description: "An understated pair of relaxed trousers with a comfortable drape and a versatile everyday profile.",
    price: 5700, stock: 20, image_url: "https://images.unsplash.com/photo-1506629905607-d9e3b5e7dfc4?auto=format&fit=crop&w=1000&q=85", featured: 0
  },
  {
    id: "minimal-leather-wallet", name: "Minimal Wallet", category: "Accessories",
    description: "A slim profile, considered storage and a no-fuss design for everyday carry.",
    price: 2650, stock: 30, image_url: "https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=1000&q=85", featured: 0
  },
  {
    id: "textured-overshirt", name: "Textured Overshirt", category: "Clothing",
    description: "A transitional layer with subtle texture, practical pockets and a relaxed structure.",
    price: 7100, stock: 10, image_url: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=1000&q=85", featured: 0
  },
  {
    id: "everyday-canvas-cap", name: "Everyday Canvas Cap", category: "Accessories",
    description: "A pared-back canvas cap that adds an easy finishing touch without overthinking the outfit.",
    price: 1850, stock: 40, image_url: "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&w=1000&q=85", featured: 0
  },
  {
    id: "quiet-morning-mug", name: "Quiet Morning Mug", category: "Home",
    description: "A ceramic-inspired everyday form for a slower start and a favourite hot drink.",
    price: 1450, stock: 25, image_url: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=1000&q=85", featured: 0
  },
  {
    id: "woven-storage-basket", name: "Woven Storage Basket", category: "Home",
    description: "Natural texture and practical storage for small essentials around the home.",
    price: 3200, stock: 14, image_url: "https://images.unsplash.com/photo-1593085260707-5377ba37f868?auto=format&fit=crop&w=1000&q=85", featured: 0
  },
  {
    id: "classic-weekday-sneaker", name: "Weekday Sneaker", category: "Footwear",
    description: "A versatile everyday sneaker with a clean profile made to pair with your regular rotation.",
    price: 7900, stock: 12, image_url: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1000&q=85", featured: 0
  },
  {
    id: "cotton-weekend-shirt", name: "Cotton Weekend Shirt", category: "Clothing",
    description: "A crisp, easy-wearing shirt with a relaxed fit and a timeless everyday character.",
    price: 4450, stock: 22, image_url: "https://images.unsplash.com/photo-1603252110481-7ba873bf42ab?auto=format&fit=crop&w=1000&q=85", featured: 0
  }
];

function seedProducts(db) {
  const count = db.prepare("SELECT COUNT(*) AS count FROM products").get().count;
  if (count > 0) return;

  const insert = db.prepare(`
    INSERT INTO products
      (id, name, category, description, price, stock, image_url, featured, active)
    VALUES
      (@id, @name, @category, @description, @price, @stock, @image_url, @featured, 1)
  `);

  const transaction = db.transaction((items) => {
    for (const item of items) insert.run(item);
  });
  transaction(products);
}

module.exports = { products, seedProducts };
