
const styleEnums = ["T-Shirt","Trousers","Midaxi Skirt","Chinos","Jumper","Bicker Jacket","Pyjama","Pant", "Baby Tee","Tracksuit", "Corset","Tights", "Trunks", "PullOver","Vintage", "Tank-Top" , "Shirt","Skirt","Mini Skirt","Maxi Skirt","Waistcoat", "BodySuit", "Jeans","Crop-Top", "Tube-Top", "Peplum", "Tunic", "Blouse", "Sweater", "Cardigan","Vest", "Jacket", "Coat", "Poncho", "Cape", "Kimono", "Kaftan","Work","Street", "Sweatshirt", "Pullover", "Polo", "Turtleneck", "Halter", "Jean", "Bralet", "Hoodie", "Oversized T-shirt", "Top & Skirt", "Top & Trouser","2-in-1 Shorts", "Top & Shorts", "Top & Jacket","Hot Pant", "Jumper Dress", "Jumpsuit", "Gilet","Playsuit", "Romper", "Dungaree", "Overalls", "Coveralls","Thong", "Nightie", "Knicker", "Boiler Suit", "Catsuit", "Unitard", "Leotard", "Bodysuit", "Swimsuit", "Bikini", "Monokini", "Tankini", "Trikini", "Burkini", "Wetsuit", "Rash Guard", "Surf Suit", "Drysuit", "leggings","Bodycon Dress","Flares", "Shift Dress", "Corset Dress","Shirt Dress", "Blazer Dress","A-line Dress","Slip Dress","Jumper Dress", "Dress", "Oversized Jumper Dress", "Lingerie","Two Piece", "Three Piece", "Wide Leg Trousers","Other"]
const sleeveLengthEnums = ["Long Sleeve", "Short Sleeve", "Sleeveless", "Off Shoulder", "Strapless", "Spaghetti", "Cap Sleeve", "Puff Sleeve", "Bishop Sleeve", "Bell Sleeve", "Kimono Sleeve", "Dolman Sleeve", "Raglan Sleeve", "Batwing Sleeve", "Butterfly Sleeve", "Cold Shoulder", "One Shoulder", "Asymmetric", "Cape Sleeve", "Flounce Sleeve", "Ruffle Sleeve", "Tiered Sleeve"]
const designEnums = ["Plain", "Faux Fur","Ripped","Leather","Patterned", "Printed", "Embroidered", "Sequined", "Lace", "Mesh", "Sheer", "Cut-Out", "Ruched", "Ruffled", "Tiered", "Pleated", "Frill", "Flounce", "Tie-Dye", "Tie-Front", "Wrap", "Twist", "Knot", "Bow", "Belted", "Buckle", "Buttoned", "Zipper", "Lace-Up", "Corset", "Peplum", "Puff", "Balloon", "Bubble", "Bishop", "Kimono"]
const fasteningEnums = ["Button", "Zipper", "Hook", "Tie", "Buckle", "Lace-Up", "Corset","Cord", "Snap", "Velcro", "Elastic", "Drawstring", "Belt", "Sash", "Buckle", "Clasp", "Magnet", "Press-Stud", "Toggle", "D-Ring", "Buckle", "Braid", "Frog", "Grommet", "Knot", "Loop", "Pleat", "Ribbon", "Rope", "Ruffle", "Tassel", "Twist", "Wrap"]
const colorEnums=["Black", "White", "Red","Burgundy", "Blue", "Green", "Yellow", "Pink", "Purple", "Orange", "Brown", "Grey", "Beige", "Navy", "Teal", "Turquoise", "Mint", "Lime", "Olive", "Khaki", "Gold", "Silver", "Bronze", "Copper", "Rose Gold", "Metallic", "Neon", "Pastel", "Rainbow", "Multicolor","Lilac", "Tan", "Wine"]
const mainEnums=["Top", "Bottom", "Dress", "Matching Set", "Overalls", "Two Piece" ]
const occasionEnums = ["Casual", "Formal", "Wedding", "Bridal", "Bridesmaid", "Maternity", "Cocktail", "Beach", "Summer", "Winter", "Spring", "Autumn", "Fall",  "Retro", "Boho", "Chic", "Sexy", "Party", "Evening", "Work", "Office", "Business", "Corporate",  "Smart Casual", "Dressy", "Festive", "Holiday", "Vacation", "Date","Funeral","Travel", "Resort", "Cruise", "Camping", "Hiking", "Outdoor", "Gym", "Athletic", "Sports", "Fitness", "Yoga", "Pilates", "Dance", "Ballet", "Gymnastics", "Running", "Jogging", "Walking", "Cycling", "Swimming", "Surfing", "Skiing", "Snowboarding", "Skating",  "Skateboarding", "Scootering", "Horse Riding","Sports"]
const fitEnums = ["Regular", "Slim", "Skinny", "Straight", "Bootcut", "Flare", "Wide-Leg", "Cropped", "Culotte", "Palazzo", "Paperbag", "Pegged", "Tapered", "Carrot", "Boyfriend", "Mom", "Dad", "High-Waist", "Low-Waist", "Mid-Waist", "Drop-Waist","Plus-Size", "Petite", "Maternity", "Tall", "Short", "Long", "Regular", "Oversized", "Fitted", "Relaxed", "Baggy", "Slouchy", "Boxy", "Flowy", "Draped", "Tailored","Maternity"]
const brandEnums=["Adidas", "Nike", "Puma", "Reebok", "Under Armour", "New Balance", "Asics", "Converse", "Vans", "Fila", "Skechers", "Salomon", "Merrell", "Brooks", "Hoka One One", "Altra", "On", "Saucony", "Mizuno", "Karhu", "La Sportiva", "Inov-8", "Topo Athletic", "Arc'teryx", "Icebug", "Scarpa", "Dynafit", "Salming", "Vibram", "Lems", "Xero Shoes", "Luna Sandals", "Bedrock Sandals", "Earth Runners", "Shamma Sandals", "Unshoes", "Vivobarefoot", "Zeap", "Other"]
const sizeEnums = [
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "XXXL",
  "XXXXL",
  "2","4", 
  "6",
  "8",
  "10",
  "12",
  "14",
  "16",
  "18",
  "20",
  "22",
  "24",
  "26",
  "28",
  "30"
]


const genderEnums = ["Male", "Female"];
const ageGroupEnums = ["Adults", "Kids"];
const ageRangeEnums = ["0-3", "4-7", "8-12", "13-17"];
const shoeTypeEnums = [
  "Sneakers",
  "Boots",
  "Sandals",
  "Slippers",
  "Shoes",
  "Heels",
  "Flats",
  "Loafers",
  "Sliders",
  "Brogues",
];
const productTypeEnums = ["readyMadeCloth", "readyMadeShoe"];

const statusEnums = ["draft","live", "under review", "disabled"];

module.exports = {
  genderEnums,
  ageGroupEnums,
  ageRangeEnums,
  shoeTypeEnums,
  productTypeEnums,
  statusEnums,
  sizeEnums,
  styleEnums,
  sleeveLengthEnums,
  designEnums,
  fasteningEnums,
  occasionEnums,
  fitEnums,
  brandEnums,
  mainEnums,
  colorEnums
};
