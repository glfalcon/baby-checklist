/* ============================================================
   DATA LAYER — Baby Checklist
   ============================================================
   All checklist items live here. This file is the single source
   of truth and is designed to be easily swapped out for a
   Google Sheets API fetch in the future.

   Each item follows this schema:
   {
     id:          String  — unique identifier (used as localStorage key)
     section:     String  — "newborn-essentials" | "hospital-bag"
     category:    String  — grouping within section
     name:        String  — display name
     description: String  — short helper text
     priority:    String  — "essential" | "recommended" | "nice-to-have"
     quantity:    Number  — suggested quantity
   }

   Future: replace this static array with a fetch to Google Sheets
   using the Sheets API v4 endpoint, mapping columns to the same
   schema so the rest of the app works unchanged.
   ============================================================ */

const CHECKLIST_DATA = [

  // ===================== NEWBORN ESSENTIALS =====================

  // -- Feeding --
  { id: "ne-001", section: "newborn-essentials", category: "Feeding", name: "Baby Bottles (various sizes)", description: "Start with 4oz for newborns, move to 8oz later", priority: "essential", quantity: 6 },
  { id: "ne-002", section: "newborn-essentials", category: "Feeding", name: "Bottle Brush Set", description: "For cleaning bottles and nipples", priority: "essential", quantity: 1 },
  { id: "ne-003", section: "newborn-essentials", category: "Feeding", name: "Formula (if not breastfeeding)", description: "Consult pediatrician for brand recommendations", priority: "essential", quantity: 1 },
  { id: "ne-004", section: "newborn-essentials", category: "Feeding", name: "Breast Pump", description: "Electric or manual depending on needs", priority: "recommended", quantity: 1 },
  { id: "ne-005", section: "newborn-essentials", category: "Feeding", name: "Nursing Pillow", description: "Supports comfortable feeding position", priority: "recommended", quantity: 1 },
  { id: "ne-006", section: "newborn-essentials", category: "Feeding", name: "Burp Cloths", description: "Keep several on hand for spit-up", priority: "essential", quantity: 10 },
  { id: "ne-007", section: "newborn-essentials", category: "Feeding", name: "Bibs", description: "Soft bibs for feeding time", priority: "recommended", quantity: 8 },
  { id: "ne-008", section: "newborn-essentials", category: "Feeding", name: "Bottle Drying Rack", description: "Dedicated space for drying bottles and parts", priority: "nice-to-have", quantity: 1 },
  { id: "ne-009", section: "newborn-essentials", category: "Feeding", name: "Milk Storage Bags", description: "For storing pumped breast milk", priority: "recommended", quantity: 1 },
  { id: "ne-010", section: "newborn-essentials", category: "Feeding", name: "High Chair (for later)", description: "Needed around 6 months when starting solids", priority: "nice-to-have", quantity: 1 },

  // -- Diapering --
  { id: "ne-011", section: "newborn-essentials", category: "Diapering", name: "Newborn Diapers (Size N & 1)", description: "Stock up — expect 10-12 changes per day", priority: "essential", quantity: 2 },
  { id: "ne-012", section: "newborn-essentials", category: "Diapering", name: "Baby Wipes (fragrance-free)", description: "Sensitive skin wipes are best for newborns", priority: "essential", quantity: 4 },
  { id: "ne-013", section: "newborn-essentials", category: "Diapering", name: "Diaper Cream / Rash Ointment", description: "Zinc oxide based for diaper rash prevention", priority: "essential", quantity: 2 },
  { id: "ne-014", section: "newborn-essentials", category: "Diapering", name: "Changing Pad", description: "Waterproof pad for changing station", priority: "essential", quantity: 1 },
  { id: "ne-015", section: "newborn-essentials", category: "Diapering", name: "Changing Pad Covers", description: "Washable covers — have extras for laundry days", priority: "recommended", quantity: 3 },
  { id: "ne-016", section: "newborn-essentials", category: "Diapering", name: "Diaper Pail", description: "Contains odors from dirty diapers", priority: "recommended", quantity: 1 },
  { id: "ne-017", section: "newborn-essentials", category: "Diapering", name: "Diaper Bag", description: "Organized bag for on-the-go changes", priority: "essential", quantity: 1 },

  // -- Clothing --
  { id: "ne-018", section: "newborn-essentials", category: "Clothing", name: "Onesies / Bodysuits (Newborn & 0-3M)", description: "Short and long sleeve mix", priority: "essential", quantity: 10 },
  { id: "ne-019", section: "newborn-essentials", category: "Clothing", name: "Sleepers / Footie Pajamas", description: "Zip-up styles are easiest for night changes", priority: "essential", quantity: 6 },
  { id: "ne-020", section: "newborn-essentials", category: "Clothing", name: "Baby Socks", description: "Soft socks to keep tiny feet warm", priority: "essential", quantity: 8 },
  { id: "ne-021", section: "newborn-essentials", category: "Clothing", name: "Baby Hats / Beanies", description: "Newborns lose heat through their heads", priority: "essential", quantity: 3 },
  { id: "ne-022", section: "newborn-essentials", category: "Clothing", name: "Mittens (scratch prevention)", description: "Prevents baby from scratching their face", priority: "recommended", quantity: 3 },
  { id: "ne-023", section: "newborn-essentials", category: "Clothing", name: "Swaddle Blankets", description: "Muslin or stretchy wraps for swaddling", priority: "essential", quantity: 4 },
  { id: "ne-024", section: "newborn-essentials", category: "Clothing", name: "Sleep Sacks / Wearable Blankets", description: "Safer alternative to loose blankets", priority: "recommended", quantity: 2 },

  // -- Sleep --
  { id: "ne-025", section: "newborn-essentials", category: "Sleep", name: "Crib or Bassinet", description: "Firm, flat mattress meeting safety standards", priority: "essential", quantity: 1 },
  { id: "ne-026", section: "newborn-essentials", category: "Sleep", name: "Crib Mattress", description: "Firm mattress that fits snugly with no gaps", priority: "essential", quantity: 1 },
  { id: "ne-027", section: "newborn-essentials", category: "Sleep", name: "Fitted Crib Sheets", description: "Soft cotton or bamboo sheets", priority: "essential", quantity: 3 },
  { id: "ne-028", section: "newborn-essentials", category: "Sleep", name: "Waterproof Mattress Protector", description: "Protects mattress from leaks", priority: "essential", quantity: 2 },
  { id: "ne-029", section: "newborn-essentials", category: "Sleep", name: "Baby Monitor", description: "Audio or video monitor for peace of mind", priority: "recommended", quantity: 1 },
  { id: "ne-030", section: "newborn-essentials", category: "Sleep", name: "White Noise Machine", description: "Helps baby sleep with consistent ambient sound", priority: "recommended", quantity: 1 },
  { id: "ne-031", section: "newborn-essentials", category: "Sleep", name: "Nightlight", description: "Soft light for nighttime feedings and changes", priority: "nice-to-have", quantity: 1 },
  { id: "ne-032", section: "newborn-essentials", category: "Sleep", name: "Blackout Curtains", description: "Keeps nursery dark for naps and bedtime", priority: "recommended", quantity: 1 },

  // -- Bathing & Grooming --
  { id: "ne-033", section: "newborn-essentials", category: "Bathing & Grooming", name: "Baby Bathtub", description: "Infant tub with newborn sling insert", priority: "essential", quantity: 1 },
  { id: "ne-034", section: "newborn-essentials", category: "Bathing & Grooming", name: "Baby Wash & Shampoo", description: "Tear-free, gentle formula", priority: "essential", quantity: 1 },
  { id: "ne-035", section: "newborn-essentials", category: "Bathing & Grooming", name: "Baby Lotion", description: "Fragrance-free for sensitive skin", priority: "recommended", quantity: 1 },
  { id: "ne-036", section: "newborn-essentials", category: "Bathing & Grooming", name: "Soft Washcloths", description: "Gentle cloths for bath time", priority: "essential", quantity: 6 },
  { id: "ne-037", section: "newborn-essentials", category: "Bathing & Grooming", name: "Hooded Baby Towels", description: "Keeps baby warm after bath", priority: "essential", quantity: 3 },
  { id: "ne-038", section: "newborn-essentials", category: "Bathing & Grooming", name: "Baby Nail Clippers / File", description: "Tiny nails grow fast — keep them trimmed", priority: "essential", quantity: 1 },
  { id: "ne-039", section: "newborn-essentials", category: "Bathing & Grooming", name: "Baby Brush / Comb", description: "Soft bristle brush for cradle cap", priority: "nice-to-have", quantity: 1 },

  // -- Health & Safety --
  { id: "ne-040", section: "newborn-essentials", category: "Health & Safety", name: "Digital Thermometer", description: "Rectal thermometer recommended for infants", priority: "essential", quantity: 1 },
  { id: "ne-041", section: "newborn-essentials", category: "Health & Safety", name: "Infant Saline Drops & Nasal Aspirator", description: "For clearing stuffy noses", priority: "essential", quantity: 1 },
  { id: "ne-042", section: "newborn-essentials", category: "Health & Safety", name: "Baby Medicine Dispenser", description: "Syringe style for accurate dosing", priority: "recommended", quantity: 1 },
  { id: "ne-043", section: "newborn-essentials", category: "Health & Safety", name: "Infant Gas Drops", description: "Simethicone drops for gas relief", priority: "recommended", quantity: 1 },
  { id: "ne-044", section: "newborn-essentials", category: "Health & Safety", name: "Pacifiers", description: "Orthodontic, one-piece design for safety", priority: "recommended", quantity: 4 },
  { id: "ne-045", section: "newborn-essentials", category: "Health & Safety", name: "Outlet Covers & Baby Proofing Kit", description: "Start baby-proofing early", priority: "nice-to-have", quantity: 1 },

  // -- Travel & Gear --
  { id: "ne-046", section: "newborn-essentials", category: "Travel & Gear", name: "Infant Car Seat", description: "Rear-facing, meets latest safety standards", priority: "essential", quantity: 1 },
  { id: "ne-047", section: "newborn-essentials", category: "Travel & Gear", name: "Stroller", description: "Compatible with car seat or full travel system", priority: "essential", quantity: 1 },
  { id: "ne-048", section: "newborn-essentials", category: "Travel & Gear", name: "Baby Carrier / Wrap", description: "Hands-free carrying for bonding and convenience", priority: "recommended", quantity: 1 },
  { id: "ne-049", section: "newborn-essentials", category: "Travel & Gear", name: "Portable Changing Pad", description: "Folds up for diaper changes on the go", priority: "recommended", quantity: 1 },
  { id: "ne-050", section: "newborn-essentials", category: "Travel & Gear", name: "Car Window Sun Shades", description: "Protects baby from sun during car rides", priority: "nice-to-have", quantity: 2 },
  { id: "ne-051", section: "newborn-essentials", category: "Travel & Gear", name: "Baby Swing / Bouncer", description: "Soothing motion to calm fussy babies", priority: "recommended", quantity: 1 },
  { id: "ne-052", section: "newborn-essentials", category: "Travel & Gear", name: "Play Mat / Activity Gym", description: "Tummy time and sensory stimulation", priority: "recommended", quantity: 1 },

  // -- Nursery --
  { id: "ne-053", section: "newborn-essentials", category: "Nursery", name: "Dresser / Storage for Baby Clothes", description: "Anchored to wall for safety", priority: "recommended", quantity: 1 },
  { id: "ne-054", section: "newborn-essentials", category: "Nursery", name: "Diaper Caddy / Organizer", description: "Portable organizer for diapering supplies", priority: "recommended", quantity: 1 },
  { id: "ne-055", section: "newborn-essentials", category: "Nursery", name: "Laundry Basket for Baby Clothes", description: "Separate hamper for baby laundry", priority: "nice-to-have", quantity: 1 },
  { id: "ne-056", section: "newborn-essentials", category: "Nursery", name: "Baby-Safe Laundry Detergent", description: "Free & clear formula for sensitive skin", priority: "essential", quantity: 1 },

  // ===================== HOSPITAL BAG =====================

  // -- For Mom --
  { id: "hb-001", section: "hospital-bag", category: "For Mom", name: "Photo ID & Insurance Card", description: "Required for hospital admission", priority: "essential", quantity: 1 },
  { id: "hb-002", section: "hospital-bag", category: "For Mom", name: "Birth Plan (copies)", description: "Have several printed copies to share with staff", priority: "recommended", quantity: 1 },
  { id: "hb-003", section: "hospital-bag", category: "For Mom", name: "Comfortable Robe", description: "Easy to open for nursing and skin-to-skin", priority: "essential", quantity: 1 },
  { id: "hb-004", section: "hospital-bag", category: "For Mom", name: "Nursing-Friendly Pajamas / Gown", description: "Comfortable for recovery and breastfeeding", priority: "essential", quantity: 2 },
  { id: "hb-005", section: "hospital-bag", category: "For Mom", name: "Non-Slip Socks / Slippers", description: "Warm and safe for walking hospital halls", priority: "essential", quantity: 2 },
  { id: "hb-006", section: "hospital-bag", category: "For Mom", name: "Nursing Bra", description: "Comfortable support for breastfeeding", priority: "essential", quantity: 2 },
  { id: "hb-007", section: "hospital-bag", category: "For Mom", name: "Underwear (comfortable / disposable)", description: "High-waist postpartum underwear recommended", priority: "essential", quantity: 5 },
  { id: "hb-008", section: "hospital-bag", category: "For Mom", name: "Toiletries Bag", description: "Toothbrush, toothpaste, deodorant, lip balm, hair ties", priority: "essential", quantity: 1 },
  { id: "hb-009", section: "hospital-bag", category: "For Mom", name: "Going Home Outfit", description: "Comfortable, loose-fitting clothes", priority: "essential", quantity: 1 },
  { id: "hb-010", section: "hospital-bag", category: "For Mom", name: "Phone Charger (long cord)", description: "Extra-long cable for reaching the bed", priority: "essential", quantity: 1 },
  { id: "hb-011", section: "hospital-bag", category: "For Mom", name: "Snacks & Water Bottle", description: "High-energy snacks for labor and recovery", priority: "recommended", quantity: 1 },
  { id: "hb-012", section: "hospital-bag", category: "For Mom", name: "Pillow from Home", description: "Familiar comfort during hospital stay", priority: "nice-to-have", quantity: 1 },
  { id: "hb-013", section: "hospital-bag", category: "For Mom", name: "Entertainment (book, tablet, headphones)", description: "For downtime during early labor or recovery", priority: "nice-to-have", quantity: 1 },
  { id: "hb-014", section: "hospital-bag", category: "For Mom", name: "Nipple Cream / Lanolin", description: "For sore nipples from early breastfeeding", priority: "recommended", quantity: 1 },
  { id: "hb-015", section: "hospital-bag", category: "For Mom", name: "Breast Pads", description: "Disposable or reusable for leaks", priority: "recommended", quantity: 1 },
  { id: "hb-016", section: "hospital-bag", category: "For Mom", name: "Peri Bottle", description: "For postpartum hygiene (hospital may provide)", priority: "recommended", quantity: 1 },
  { id: "hb-017", section: "hospital-bag", category: "For Mom", name: "Stool Softener", description: "For postpartum comfort (check with doctor)", priority: "recommended", quantity: 1 },

  // -- For Baby --
  { id: "hb-018", section: "hospital-bag", category: "For Baby", name: "Going Home Outfit", description: "Seasonally appropriate outfit for the ride home", priority: "essential", quantity: 1 },
  { id: "hb-019", section: "hospital-bag", category: "For Baby", name: "Newborn Hat", description: "Keep baby warm, especially in cooler months", priority: "essential", quantity: 1 },
  { id: "hb-020", section: "hospital-bag", category: "For Baby", name: "Swaddle Blanket", description: "For wrapping baby snug on the way home", priority: "essential", quantity: 2 },
  { id: "hb-021", section: "hospital-bag", category: "For Baby", name: "Infant Car Seat (installed)", description: "Must be properly installed before hospital discharge", priority: "essential", quantity: 1 },
  { id: "hb-022", section: "hospital-bag", category: "For Baby", name: "Newborn Diapers (small pack)", description: "Hospital provides some, but have extras ready", priority: "recommended", quantity: 1 },
  { id: "hb-023", section: "hospital-bag", category: "For Baby", name: "Baby Wipes", description: "Small pack for the hospital stay", priority: "recommended", quantity: 1 },
  { id: "hb-024", section: "hospital-bag", category: "For Baby", name: "Pacifier", description: "If you plan to use one from the start", priority: "nice-to-have", quantity: 1 },
  { id: "hb-025", section: "hospital-bag", category: "For Baby", name: "Socks / Booties", description: "Tiny socks to keep feet warm", priority: "recommended", quantity: 2 },

  // -- For Partner --
  { id: "hb-026", section: "hospital-bag", category: "For Partner", name: "Change of Clothes (2 sets)", description: "Comfortable clothes for a multi-day stay", priority: "essential", quantity: 2 },
  { id: "hb-027", section: "hospital-bag", category: "For Partner", name: "Toiletries Bag", description: "Personal hygiene essentials", priority: "essential", quantity: 1 },
  { id: "hb-028", section: "hospital-bag", category: "For Partner", name: "Snacks", description: "Cafeteria may not always be open", priority: "recommended", quantity: 1 },
  { id: "hb-029", section: "hospital-bag", category: "For Partner", name: "Phone Charger", description: "Keep charged for photos and updates", priority: "essential", quantity: 1 },
  { id: "hb-030", section: "hospital-bag", category: "For Partner", name: "Camera", description: "For capturing first moments (phone works too)", priority: "nice-to-have", quantity: 1 },
  { id: "hb-031", section: "hospital-bag", category: "For Partner", name: "Pillow & Blanket", description: "Hospital partner sleeping can be uncomfortable", priority: "nice-to-have", quantity: 1 },
  { id: "hb-032", section: "hospital-bag", category: "For Partner", name: "Cash / Cards", description: "For vending machines, parking, cafeteria", priority: "essential", quantity: 1 },

  // -- Documents & Essentials --
  { id: "hb-033", section: "hospital-bag", category: "Documents & Essentials", name: "Pre-Registration Paperwork", description: "Complete hospital pre-registration ahead of time", priority: "essential", quantity: 1 },
  { id: "hb-034", section: "hospital-bag", category: "Documents & Essentials", name: "Pediatrician Contact Info", description: "Hospital will need your chosen pediatrician", priority: "essential", quantity: 1 },
  { id: "hb-035", section: "hospital-bag", category: "Documents & Essentials", name: "List of Emergency Contacts", description: "Phone numbers for family and support people", priority: "essential", quantity: 1 },
  { id: "hb-036", section: "hospital-bag", category: "Documents & Essentials", name: "Cord Blood Banking Kit (if applicable)", description: "If you've arranged cord blood banking", priority: "nice-to-have", quantity: 1 },
];
