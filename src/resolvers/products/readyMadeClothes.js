
const { checkForDuplicates } = require("../../helpers/utils");
const { ageGroupEnums,ageRangeEnums, genderEnums,
  sleeveLengthEnums,
  fasteningEnums,
  occasionEnums,
  fitEnums,colorEnums,
  brandEnums, 
  clothStyleEnums,
  designEnums,
  clothSizeEnums,
  mainEnums
 } = require("../../helpers/constants");
const ProductModel = require("../../models/products");
const { validateVariations, verifyColorsHasImages } = require("./productHelpers");


const editReadyMadeClothes = async (req) => {
  try {
   
    const params = req.body;
    const { productId ,categories, sizes, colors, variations} = params;
    
    if(sizes && (!Array.isArray(sizes) || sizes.length === 0 || checkForDuplicates(sizes))){
      return { error: "sizes is required and must be unique" };
    }
    if(categories &&  Object.keys(categories).length === 0){
      return { error: "categories is required" }
    }
    
    if(categories){
      const {gender, age,
        style,
        sleeveLength,
        design,
        fastening,
        occasion,
        fit,
        brand,
        main,
        heelHeight,
        heelType,
        accessoryType

      } = categories;

      if(heelHeight){
                return { error: "you can not add heelHeight to this product type" };
              }
        if(heelType){
                return { error: "you can not add heelType to this product type" };
              }
        if(accessoryType){
                return { error: "you can not add accessoryType to this product type" };
              }
      if(!gender || !Array.isArray(gender) || gender.length === 0){
        return { error: "gender category is required when updating category and must be array" };
      }
      if (gender && gender.some((s) => genderEnums.indexOf(s) === -1)) {
        return { error: "invalid gender category" }}
        if(!age || Object.keys(age).length === 0){
          return { error: "age category is required when updating category" };
        }
       
    if (age && ageGroupEnums.indexOf(age.ageGroup) === -1) {
      return { error: "invalid ageGroup category" }
    }

    if(age?.ageGroup === "kid" && !age?.ageRange){
      return { error: "ageRange is required when ageGroup is kid" };
    }
 
    if(age?.ageRange && ageRangeEnums.indexOf(age?.ageRange) === -1){
      return { error: "invalid ageRange category" };
    }

  
    if(!style || !Array.isArray(style) || style.length === 0){
      return { error: "style under category is required and must be an array" };
    }

    if(!main || !Array.isArray(main|| main.length === 0)){
      return { error: "main category is required when updating category" };
    }
   
    if(main.some((s) => mainEnums.indexOf(s) === -1)){
     
      return { error: "invalid main category" };
    }
    if (style && style.some((s) => clothStyleEnums.indexOf(s) === -1)) {
      return { error: "invalid style category when updating category" };
    }
   
    if (sleeveLength && typeof sleeveLength !== "string") {
      return { error: "sleeveLength category must be a string" };
    }
    if (sleeveLength && sleeveLengthEnums.indexOf(sleeveLength) === -1) {
      return { error: "invalid sleeveLength category" };
    }
    if (design && design.some((s) => designEnums.indexOf(s) === -1)) {
      return { error: "invalid design category" };
    }
    if (fastening && fastening.some((s) => fasteningEnums.indexOf(s) === -1)) {
      return { error: "invalid fastening category" };
    }
    if (occasion && occasion.some((s) => occasionEnums.indexOf(s) === -1)) {
      return { error: "invalid occasion category" };
    }
    if (fit && fit.some((s) => fitEnums.indexOf(s) === -1)) {
      return { error: "invalid fit category" };
    }
    if (brand && brandEnums.indexOf(brand) === -1) {
      return { error: "invalid brand category" };
    }
    categories.productGroup = "Ready-Made";
    
    }
    if(colors){
      return { error: "you can not update colors with this endpoint" };
    }
    if(variations){
      return { error: "you can not update variations with this endpoint" };
    }
    
  
    console.log("here");
    // remove productId from params
    delete params.productId;
  
  
    const readyMadeCloth = await ProductModel.findOneAndUpdate(
      {productId},
      {
        ...params,
      },
      { new: true }
    );
    return readyMadeCloth;
  } catch (err) {
    return  { error: err.message };
  }
};





const validateReadyMadeClothes = async (product) => {
  const {categories, sizes, colors, images, variations  } = product;
  if (!categories || Object.keys(categories).length === 0) {
    return { error: "categories is required" }
  }
  

  const gender = categories?.gender;
  if (!gender || !Array.isArray(gender)|| gender.length === 0) {
    return { error: "gender category is required" };
  }
  if(gender?.some((s) => genderEnums.indexOf(s) === -1)){
    return { error: "invalid gender category" };
  }
  
  const main = categories?.main;
  if (!main || !Array.isArray(main|| main.length === 0)) {
    return { error: "main category is required" };
  }
  if(main?.some((s) => mainEnums.indexOf(s) === -1)){
    return { error: "invalid main category" };
  }
  const age = categories?.age
  if(!age || Object.keys(age).length === 0){
    return { error: "age category is required when updating category" };
  }
  if (age && ageGroupEnums.indexOf(age.ageGroup) === -1) {
    return { error: "invalid ageGroup category" }
  }

  if(age?.ageGroup === "kid" && !age?.ageRange){
    return { error: "ageRange is required when ageGroup is kid" };
  }

  if(age?.ageRange && ageRangeEnums.indexOf(age?.ageRange) === -1){
    return { error: "invalid ageRange category" };
  }
  const style = categories?.style;
  if (!style || !Array.isArray(style) || style.length === 0) {
    return { error: "style under category is required and must be an array" };
  }
  if (style?.some((s) => clothStyleEnums.indexOf(s) === -1)) {
    return { error: "invalid style category" };
  }
  const sleeveLength = categories?.sleeveLength;
  if (sleeveLength && typeof sleeveLength !== "string") {
    return { error: "sleeveLength category must be a string" };
  }
  if (sleeveLength && sleeveLengthEnums.indexOf(sleeveLength) === -1) {
    return { error: "invalid sleeveLength category" };
  }
  const design = categories?.design;
  if (design && !Array.isArray(design)) {
    return { error: "design under category must be an array" };
  }
  if (design && design.some((s) => designEnums.indexOf(s) === -1)) {
    return { error: "invalid design category" };
  }
  const fastening = categories?.fastening;
  if (fastening && !Array.isArray(fastening)) {
    return { error: "fastening under category must be an array" };
  }
  if (fastening && fastening.some((s) => fasteningEnums.indexOf(s) === -1)) {
    return { error: "invalid fastening category" };
  }
  const occasion = categories?.occasion;
  if (occasion && !Array.isArray(occasion)) {
    return { error: "occasion under category must be an array" };
  }
  if (occasion && occasion.some((s) => occasionEnums.indexOf(s) === -1)) {
    return { error: "invalid occasion category" };
  }
  const fit = categories?.fit;
  if (fit && !Array.isArray(fit)) {
    return { error: "fit under category must be an array" };
  }
  if (fit && fit.some((s) => fitEnums.indexOf(s) === -1)) {
    return { error: "invalid fit category" };
  }
  const brand = categories?.brand;
  if (brand && brandEnums.indexOf(brand) === -1) {
    return { error: "invalid brand category" };
  }
  if (
    !sizes ||
    !Array.isArray(sizes) ||
    sizes.length === 0 ||
    checkForDuplicates(sizes)
  ) {
    return { error: "sizes is required and must be unique" };
  }
  if(sizes.some((s) => clothSizeEnums.indexOf(s) === -1)){
    return { error: "invalid size category" };
  }
   // check for duplicates in color.value in colors array
   const colorValues = colors.map((color) => color.value);
   if (checkForDuplicates(colorValues)) {
     return { error: "color value must be unique in the colors array" };
   }
    // check colors has images
    if (!verifyColorsHasImages(colors)) {
      return { error: "colors must have images and must be in right format" };
    }
    
    
    // check for duplicates in variations array
    const variationValues = variations.map((variation) => variation.sku);
    if (checkForDuplicates(variationValues)) {
      return { error: "sku must be unique in the variations array" };
    }
    
    // check variations has correct size, colorValue, price, quantity
    const isValidVariations = validateVariations(variations, sizes, colors);
    if (!isValidVariations) {
      return { error: "invalid variations array" };
    }
    return true;



};
const addVariationToReadyMadeClothes = async (product, variation) => {

    
    const {price, colorValue, size, quantity} = variation;
    const { colors, sizes, variations } = product;
 let sku;
    if (!variation) {
      return { error: "variation is required" };
    }
    if (!price || typeof price !== "number" || price < 0) {
      return { error: "price is required and must be a number greater than 0" };
    }
    if (!colorValue) {
      return { error: "colorValue is required" };
    }
    if (!size) {
      return { error: "size is required" };
    }
    if (!quantity || typeof quantity !== "number" || quantity < 0) {
      return { error: "quantity is required and must be a number greater than 0" };
    }
    if (!sizes.includes(size)) {
      return { error: "size is not valid" };
    }
    if (!colors.map((color) => color.value).includes(colorValue)) {
      return { error: "colorValue is not valid" };
    }
    if(variation?.sku){
      // edit variation
      sku = variation.sku;
      const isExist = variations.some((v) => v.sku === sku);
      if (!isExist) {
        return { error: "variation does not exist" };
      }
      const index = variations.findIndex((v) => v.sku === sku);
      variations[index] = { ...variation };
      await product.save();
      return variations[index];

    }
    sku =  `${product.productId}-${size}-${colorValue}`;
    const isExist = variations.some((v) => v.sku === sku);
    if (isExist) {
      return { error: "variation of same color and size already exists" };
    }
    const newVariation = {
      sku,
      price,
      colorValue,
      size,
      quantity,
    };
    variations.push(newVariation);
   
    await product.save();
    return newVariation;



  }
   

module.exports = {

  editReadyMadeClothes,
  validateReadyMadeClothes,
  addVariationToReadyMadeClothes
};
