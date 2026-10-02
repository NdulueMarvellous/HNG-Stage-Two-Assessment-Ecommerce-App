-- ============================================================================
--  TechMart - demo catalogue (12 products)
--  Run AFTER schema.sql, in the Supabase SQL Editor.
--  Fixed ids + `on conflict do nothing` mean it is safe to re-run and it will
--  not wipe stock levels that checkout has already reduced.
--  The last product is intentionally out of stock to show stock handling.
-- ============================================================================

insert into public.products (id, name, description, price, image_url, category, stock) values
(
  '11111111-1111-4111-8111-000000000001',
  'Aurora Wireless Headphones',
  'Over-ear Bluetooth headphones with active noise cancelling, 40-hour battery life and a built-in microphone for calls. Folds flat for travel.',
  189000.00,
  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80',
  'Audio', 24
),
(
  '11111111-1111-4111-8111-000000000002',
  'PulseFit Smart Watch',
  'Fitness smartwatch with heart-rate and SpO2 tracking, 1.8" AMOLED display, 5ATM water resistance and 10 days of battery.',
  145500.00,
  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80',
  'Electronics', 18
),
(
  '11111111-1111-4111-8111-000000000003',
  'Trail Runner Sneakers',
  'Lightweight breathable mesh trainers with a cushioned foam midsole and a grippy rubber outsole. True to size, unisex fit.',
  62000.00,
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80',
  'Fashion', 30
),
(
  '11111111-1111-4111-8111-000000000004',
  'Nomad Leather Laptop Backpack',
  'Full-grain leather backpack with a padded 15" laptop sleeve, water-resistant lining and a hidden anti-theft pocket.',
  78000.00,
  'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=80',
  'Accessories', 12
),
(
  '11111111-1111-4111-8111-000000000005',
  'Horizon Polarised Sunglasses',
  'UV400 polarised lenses in a lightweight acetate frame with spring hinges. Includes a hard case and cleaning cloth.',
  42500.00,
  'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=900&q=80',
  'Accessories', 40
),
(
  '11111111-1111-4111-8111-000000000006',
  'Lumen Mirrorless Camera',
  '24MP mirrorless camera with 4K video, 5-axis stabilisation and a flip-out screen. Ships with an 18-55mm kit lens.',
  895000.00,
  'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=900&q=80',
  'Electronics', 6
),
(
  '11111111-1111-4111-8111-000000000007',
  'Meridian 14" Ultrabook',
  'Featherweight aluminium laptop with a 14" 2.8K display, 16GB RAM, 512GB SSD and all-day battery life.',
  1250000.00,
  'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=80',
  'Electronics', 8
),
(
  '11111111-1111-4111-8111-000000000008',
  'Echo Mini Bluetooth Speaker',
  'Pocket-sized speaker with surprisingly deep bass, IPX7 waterproofing, 12-hour playtime and USB-C charging.',
  54000.00,
  'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=900&q=80',
  'Audio', 25
),
(
  '11111111-1111-4111-8111-000000000009',
  'Tactile 75 Mechanical Keyboard',
  'Compact 75% layout with hot-swappable switches, PBT keycaps, double-shot legends and per-key RGB lighting.',
  96000.00,
  'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=900&q=80',
  'Electronics', 15
),
(
  '11111111-1111-4111-8111-000000000010',
  'Signature Eau de Parfum 100ml',
  'Warm amber and bergamot fragrance with notes of cedar and vanilla. Long-lasting, 8-10 hours of wear.',
  88000.00,
  'https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=900&q=80',
  'Accessories', 0
),
(
  '11111111-1111-4111-8111-000000000011',
  'Everyday Cotton T-Shirt',
  'Heavyweight 240gsm combed cotton tee with a relaxed unisex fit and a reinforced ribbed collar.',
  18500.00,
  'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80',
  'Fashion', 60
),
(
  '11111111-1111-4111-8111-000000000012',
  'Stoneware Mug Set (4 pcs)',
  'Set of four 350ml reactive-glaze stoneware mugs. Dishwasher and microwave safe, each one slightly unique.',
  26000.00,
  'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=900&q=80',
  'Home', 35
)
on conflict (id) do nothing;
