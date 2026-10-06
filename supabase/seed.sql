-- ============================================================================
--  TechMart - rich demo catalogue (24 tech products)
--  Run AFTER schema.sql in: Supabase Dashboard -> SQL Editor -> New query.
--  Fixed UUIDs + `on conflict (id) do nothing` mean it is safe to re-run.
-- ============================================================================

insert into public.products (id, name, description, price, image_url, category, stock) values
(
  '11111111-1111-4111-8111-000000000001',
  'Aurora Pro Wireless ANC Headphones',
  'Over-ear Bluetooth 5.3 headphones with hybrid active noise cancellation, transparency mode, 45-hour battery life, and ultra-plush memory foam earcups.',
  189000.00,
  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80',
  'Audio', 24
),
(
  '11111111-1111-4111-8111-000000000002',
  'PulseFit Pro Smartwatch',
  'Fitness smartwatch featuring 1.9" always-on AMOLED display, heart rate, ECG, SpO2 sensor, built-in GPS, 5ATM water resistance and 10 days of battery.',
  145500.00,
  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80',
  'Wearables', 18
),
(
  '11111111-1111-4111-8111-000000000003',
  'Meridian 14" M3 Ultrabook',
  'Featherweight aerospace-grade aluminum laptop with a 14" 2.8K Retina OLED display, 16GB unified RAM, 512GB NVMe SSD and up to 18 hours battery life.',
  1250000.00,
  'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=80',
  'Computers', 8
),
(
  '11111111-1111-4111-8111-000000000004',
  'Nomad Waterproof Tech Backpack',
  'Ballistic nylon weatherproof backpack with dedicated padded 16" laptop compartment, RFID-blocking travel pocket, and USB-C passthrough charging port.',
  78000.00,
  'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=80',
  'Accessories', 15
),
(
  '11111111-1111-4111-8111-000000000005',
  'Lumen 4K Mirrorless Cinema Camera',
  '33MP full-frame sensor mirrorless camera with 4K 120fps video recording, 5-axis in-body image stabilization, and dual high-speed SD card slots.',
  895000.00,
  'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=900&q=80',
  'Cameras', 6
),
(
  '11111111-1111-4111-8111-000000000006',
  'Echo SoundCore Mini Speaker',
  'Pocket-sized Bluetooth speaker with 360-degree punchy bass, IPX7 waterproof rating, 14-hour playtime and wireless stereo pairing support.',
  54000.00,
  'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=900&q=80',
  'Audio', 30
),
(
  '11111111-1111-4111-8111-000000000007',
  'Tactile 75 Wireless Mechanical Keyboard',
  'Custom 75% mechanical keyboard with hot-swappable tactile switches, sound-dampening silicone gaskets, double-shot PBT keycaps and RGB backlight.',
  96000.00,
  'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=900&q=80',
  'Gaming', 20
),
(
  '11111111-1111-4111-8111-000000000008',
  'Apex Vision 34" Curved Gaming Monitor',
  '34-inch UWQHD (3440x1440) 165Hz 1ms curved gaming monitor with HDR400, 1500R curvature, AMD FreeSync Premium and built-in USB hub.',
  485000.00,
  'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=900&q=80',
  'Computers', 10
),
(
  '11111111-1111-4111-8111-000000000009',
  'Nova Buds True Wireless Earphones',
  'In-ear wireless earbuds with active noise cancellation, spatial audio with dynamic head tracking, IP54 sweat resistance, and Qi wireless charging.',
  85000.00,
  'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=900&q=80',
  'Audio', 35
),
(
  '11111111-1111-4111-8111-000000000010',
  'OmniCharge 100W GaN Fast Charger',
  'Compact 4-port Gallium Nitride (GaN) desktop fast charger with 2x USB-C PD 100W, 2x USB-A QC 3.0, capable of fast-charging laptops and phones simultaneously.',
  42000.00,
  'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=900&q=80',
  'Accessories', 45
),
(
  '11111111-1111-4111-8111-000000000011',
  'ProGlide Ultra Wireless Gaming Mouse',
  'Lightweight 58g ergonomic wireless mouse with 26,000 DPI optical sensor, optical switches rated for 90M clicks, and 80 hours continuous battery life.',
  58000.00,
  'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=900&q=80',
  'Gaming', 25
),
(
  '11111111-1111-4111-8111-000000000012',
  'Titan MagSafe Power Bank 20,000mAh',
  'High-capacity magnetic wireless power bank with 15W wireless output, 30W USB-C bidirectional fast charging, and integrated digital LED battery percentage.',
  48000.00,
  'https://images.unsplash.com/photo-1609592807904-7669b9101d24?auto=format&fit=crop&w=900&q=80',
  'Accessories', 30
),
(
  '11111111-1111-4111-8111-000000000013',
  'Horizon Pro Studio Microphone',
  'Broadcast-grade USB/XLR cardioid condenser microphone with internal pop filter, zero-latency headphone monitoring, and RGB gain indicator ring.',
  115000.00,
  'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=900&q=80',
  'Audio', 16
),
(
  '11111111-1111-4111-8111-000000000014',
  'AeroFlight 4K Foldable Drone',
  'Compact drone with 3-axis stabilized 4K HDR camera, 35 minutes flight time, 10km HD video transmission, and automated obstacle avoidance sensors.',
  670000.00,
  'https://images.unsplash.com/photo-1527977966376-1c8408f9f108?auto=format&fit=crop&w=900&q=80',
  'Cameras', 5
),
(
  '11111111-1111-4111-8111-000000000015',
  'Lumina Smart Ambient Desk Lamp',
  'Minimalist aluminum LED desk lamp with touch slider brightness, stepless color temperature control (2700K-6500K), and built-in 15W wireless phone charger.',
  38500.00,
  'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=80',
  'Smart Home', 22
),
(
  '11111111-1111-4111-8111-000000000016',
  'Vanguard Dual Aluminum Monitor Arm',
  'Heavy-duty gas spring dual monitor mount for screens up to 32 inches. Features full 360-degree rotation, integrated cable routing channels and clamp base.',
  65000.00,
  'https://images.unsplash.com/photo-1593062096033-9a26b09da705?auto=format&fit=crop&w=900&q=80',
  'Computers', 14
),
(
  '11111111-1111-4111-8111-000000000017',
  'StreamDeck Elite Controller',
  '15 customizable LCD keys for launching actions, controlling audio, streaming software, and switching scenes with visual tactile feedback.',
  135000.00,
  'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=900&q=80',
  'Gaming', 12
),
(
  '11111111-1111-4111-8111-000000000018',
  'AuraSense Smart Air Purifier',
  'HEPA H13 filtration air purifier with real-time PM2.5 laser sensor, whisper-quiet sleep mode (22dB), and smartphone app controls for rooms up to 45m².',
  128000.00,
  'https://images.unsplash.com/photo-1585771724684-38269d6639fd?auto=format&fit=crop&w=900&q=80',
  'Smart Home', 9
),
(
  '11111111-1111-4111-8111-000000000019',
  'Quantum 2TB External Rugged SSD',
  'Shock-resistant IP65 USB 3.2 Gen 2x2 solid-state drive delivering blazing transfer speeds up to 2,000MB/s for 4K video editing and backups.',
  165000.00,
  'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=900&q=80',
  'Accessories', 28
),
(
  '11111111-1111-4111-8111-000000000020',
  'Stealth Wireless VR Headset',
  'All-in-one standalone virtual reality headset with 4K+ Infinite Display, pancake optics, spatial audio, and hand-tracking touch controllers.',
  590000.00,
  'https://images.unsplash.com/photo-1622979135225-d2ba269bc1df?auto=format&fit=crop&w=900&q=80',
  'Gaming', 7
),
(
  '11111111-1111-4111-8111-000000000021',
  'Solaris Smart Outdoor Security Camera',
  'Wire-free solar-powered security camera with 2K color night vision, AI human motion detection, two-way audio, and local encrypted SD storage.',
  89000.00,
  'https://images.unsplash.com/photo-1557597774-9d273605dfa9?auto=format&fit=crop&w=900&q=80',
  'Smart Home', 15
),
(
  '11111111-1111-4111-8111-000000000022',
  'AeroVent Ergonomic Office Chair',
  'Breathable mesh executive desk chair with dynamic lumbar support, 3D adjustable armrests, reclining lock, and smooth silent PU casters.',
  210000.00,
  'https://images.unsplash.com/photo-1580481077197-28562d98dc00?auto=format&fit=crop&w=900&q=80',
  'Accessories', 11
),
(
  '11111111-1111-4111-8111-000000000023',
  'SonicBar Pro Hi-Fi TV Soundbar',
  'Dolby Atmos 3.1 channel soundbar with wireless subwoofer, HDMI eARC, optical input, and Bluetooth streaming for room-filling cinematic audio.',
  245000.00,
  'https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=900&q=80',
  'Audio', 13
),
(
  '11111111-1111-4111-8111-000000000024',
  'CyberGrip Pro Gaming Chair - Limited Edition',
  'Ergonomic high-density foam racing chair with memory foam magnetic neck pillow and 4D metal armrests. (Currently Sold Out)',
  275000.00,
  'https://images.unsplash.com/photo-1598550476439-6847785fcea6?auto=format&fit=crop&w=900&q=80',
  'Gaming', 0
)
on conflict (id) do nothing;

