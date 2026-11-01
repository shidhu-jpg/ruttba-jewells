/* ============================================================
   RUTTBA JEWELS — STORE SETTINGS & CATALOGUE
   Edit this file only to change shop details, coupons and products.
   ============================================================ */

const STORE = {
  name: 'Ruttba Jewels',
  tagline: 'Timeless jewellery, crafted for every celebration',
  whatsapp: '919729748097',          // country code + number, no "+" or spaces
  phone: '+91 97297 48097',          // shown on site
  email: 'hello@ruttbajewels.in',    //                                          ← REPLACE
  address: 'Main Sarafa Bazar, Shahabad Markanda, Haryana',
  mapQuery: 'Ruttba Jewels',         // Google Maps search text
  hours: 'Mon – Sun · 10:30 AM – 8:30 PM',
  instagram: '',                     // full URL, leave '' to hide
  facebook: '',
  gstPercent: 3,                     // GST on gold/silver/diamond jewellery in India is 3%
  deliveryCharge: 0,                 // flat charge in ₹ (0 = free)
  freeDeliveryAbove: 0,              // waive delivery above this subtotal (0 = always use deliveryCharge)
  offerText: 'Festive Offer · Flat 10% off with code RUTTBA10 · Free insured delivery across India',
  coupons: {                         // CODE: percent off
    RUTTBA10: 10,
    WELCOME5: 5,
  },
};

const CATEGORIES = [
  { id: 'necklaces', name: 'Necklaces',   art: 'necklace', img: 'images/n2.jpg' },
  { id: 'earrings',  name: 'Earrings',    art: 'earrings', img: 'images/e1.jpg' },
  { id: 'rings',     name: 'Rings',       art: 'ring',     img: 'images/r1.jpg' },
  { id: 'bangles',   name: 'Bangles',     art: 'bangles',  img: 'images/b1.jpg' },
  { id: 'bracelets', name: 'Bracelets',   art: 'bracelet', img: 'images/br1.jpg' },
  { id: 'pendants',  name: 'Pendants',    art: 'pendant',  img: 'images/p1.jpg' },
  { id: 'bridal',    name: 'Bridal Sets', art: 'bridal',   img: 'images/bs1.jpg' },
  { id: 'silver',    name: 'Silver',      art: 'silver',   img: 'images/s1.jpg' },
];

/* img: product photo (images/ folder). Remove it to show a drawn illustration instead.
   Current photos are free-licence Unsplash stock (see images/CREDITS.md) — swap in the shop's own photos before launch.
   sizes: optional list shown as a picker (ring size, bangle size …). */
const PRODUCTS = [
  { id: 'n1', cat: 'necklaces', img: 'images/n1.jpg', name: 'Gold Bead Chain Necklace', purity: '22K Hallmarked', weight: '14.2 g', price: 96500,  mrp: 101000, best: true,  rating: 4.8, desc: 'Fine link chain with hand-finished gold beads and a matching drop.' },
  { id: 'n2', cat: 'necklaces', img: 'images/n2.jpg', name: 'Diamond Drop Necklace',    purity: '18K · VS-GH',   weight: '11.8 g', price: 148000, mrp: 159000, best: true,  rating: 4.9, desc: 'Cascading diamond-set necklace with a matching pendant drop.' },
  { id: 'n3', cat: 'necklaces', img: 'images/n3.jpg', name: 'Bridal Rani Haar',         purity: '22K Hallmarked', weight: '64 g',   price: 438000, mrp: 455000, best: false, rating: 4.9, desc: 'Layered heavy haar with intricate gold work, made for the wedding day.' },
  { id: 'e1', cat: 'earrings',  img: 'images/e1.jpg', name: 'Temple Jhumka',            purity: '22K Hallmarked', weight: '12.4 g', price: 86800,  mrp: 91000,  best: true,  rating: 4.9, desc: 'Classic temple jhumkas with Lakshmi motif and gold bead fringe.' },
  { id: 'e2', cat: 'earrings',  img: 'images/e2.jpg', name: 'Rose Gold Swirl Drops',    purity: '18K Rose Gold',  weight: '3.2 g',  price: 21500,  mrp: 23500,  best: false, rating: 4.7, desc: 'Light hook earrings with a sculpted swirl — perfect for office wear.' },
  { id: 'e3', cat: 'earrings',  img: 'images/e3.jpg', name: 'Meenakari Flower Studs',   purity: 'Gold Plated',   weight: '18 g',   price: 2400,   mrp: 3200,   best: true,  rating: 4.7, desc: 'Hand-painted floral studs with gold bead hangings.' },
  { id: 'e4', cat: 'earrings',  img: 'images/e4.jpg', name: 'Filigree Gold Studs',      purity: '22K Hallmarked', weight: '5.6 g',  price: 39800,  mrp: 42000,  best: false, rating: 4.8, desc: 'Domed filigree studs with fine granulation work.' },
  { id: 'r1', cat: 'rings',     img: 'images/r1.jpg', name: 'Kundan Cocktail Ring',     purity: '22K Hallmarked', weight: '9.4 g',  price: 66400,  mrp: 70000,  best: true,  rating: 4.8, desc: 'Statement ring with emerald centre and ruby accents.', sizes: ['10', '12', '14', '16', '18'] },
  { id: 'r2', cat: 'rings',     img: 'images/r2.jpg', name: 'Diamond Flower Ring',      purity: '18K · SI-GH',   weight: '4.1 g',  price: 52900,  mrp: 57000,  best: false, rating: 4.9, desc: 'Bloom-shaped cluster ring set with brilliant-cut diamonds.', sizes: ['10', '12', '14', '16', '18'] },
  { id: 'b1', cat: 'bangles',   img: 'images/b1.jpg', name: 'Antique Gold Bangle Set',  purity: '22K Hallmarked', weight: '48 g',   price: 328000, mrp: 342000, best: true,  rating: 4.8, desc: 'Set of carved antique-finish bangles for festive and bridal wear.', sizes: ['2.4', '2.6', '2.8'] },
  { id: 'b2', cat: 'bangles',   img: 'images/b2.jpg', name: 'Diamond Cuff Bangle',      purity: '18K White Gold', weight: '16 g',   price: 189000, mrp: 199000, best: false, rating: 4.9, desc: 'Open cuff bangle with pavé diamonds along a sculpted band.', sizes: ['2.4', '2.6', '2.8'] },
  { id: 'br1', cat: 'bracelets', img: 'images/br1.jpg', name: 'Diamond Tennis Bracelet', purity: '18K · VS',     weight: '7.8 g',  price: 89000,  mrp: 96000,  best: true,  rating: 4.9, desc: 'Line bracelet with 36 diamonds and secure box clasp.' },
  { id: 'br2', cat: 'bracelets', img: 'images/br2.jpg', name: 'Sterling Cable Bracelet', purity: '925 Silver',   weight: '14 g',   price: 3900,   mrp: 4600,   best: false, rating: 4.6, desc: 'Polished cable-link bracelet with lobster clasp.' },
  { id: 'p1', cat: 'pendants',  img: 'images/p1.jpg', name: 'Teal Stone Pendant',       purity: '18K Hallmarked', weight: '3.4 g',  price: 24900,  mrp: 27500,  best: true,  rating: 4.8, desc: 'Octagon-cut teal gemstone in a gold bezel. Chain not included.' },
  { id: 'p2', cat: 'pendants',  img: 'images/p2.jpg', name: 'Pearl Halo Pendant',       purity: '18K White Gold', weight: '2.1 g',  price: 18600,  mrp: 19900,  best: false, rating: 4.7, desc: 'Freshwater pearl wrapped in a diamond-set halo ring.' },
  { id: 'bs1', cat: 'bridal',   img: 'images/bs1.jpg', name: 'Dulhan Necklace Set',     purity: '22K Hallmarked', weight: '72 g',   price: 489000, mrp: 515000, best: true,  rating: 5.0, desc: 'Grand bridal necklace with matching long earrings.' },
  { id: 'bs2', cat: 'bridal',   img: 'images/bs2.jpg', name: 'Jaali Necklace Set',      purity: '22K Hallmarked', weight: '38 g',   price: 262000, mrp: 275000, best: false, rating: 4.8, desc: 'Lightweight jaali-work necklace with drop earrings — reception ready.' },
  { id: 's1', cat: 'silver',    img: 'images/s1.jpg', name: 'Tree of Life Pendant',     purity: '925 Silver',    weight: '5 g',    price: 2450,   mrp: 2900,   best: true,  rating: 4.8, desc: 'Cut-out tree of life pendant with 18 inch silver chain.' },
  { id: 's2', cat: 'silver',    img: 'images/s2.jpg', name: 'Hammered Couple Bands',    purity: '925 Silver',    weight: '9 g',    price: 3200,   mrp: 3800,   best: false, rating: 4.7, desc: 'Pair of textured bands — mention both ring sizes in the order note.' },
];
