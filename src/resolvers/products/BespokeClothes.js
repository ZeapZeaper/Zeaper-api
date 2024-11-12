
const { checkForDuplicates } = require("../../helpers/utils");
const { ageGroupEnums,ageRangeEnums, genderEnums,
  sleeveLengthEnums,
  fasteningEnums,
  occasionEnums,
  fitEnums,

  clothStyleEnums,
  designEnums,

  mainEnums
 } = require("../../helpers/constants");
const ProductModel = require("../../models/products");
const { validateVariations, verifyColorsHasImages } = require("./productHelpers");


const editBespokeClothes = async (req) => {
  try {
   
    const params = req.body;
    const { productId ,categories, sizes, colors, variations} = params;
    
    if(sizes){
      return { error: "you can not add size for this product type" };
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
        heelHeight,
          heelType,
          accessoryType,
        brand,
      
        main

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
      if(brand){
        return { error: "you can not add brand to this product type" };
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
   

    
    }
    if(colors){
      return { error: "you can not update colors with this endpoint" };
    }
    if(variations){
      return { error: "bespoke products do not have variations" };
    }
    categories.productGroup = "Bespoke";
    // remove productId from params
    delete params.productId;
  
  
    const bespokeCloth = await ProductModel.findOneAndUpdate(
      {productId},
      {
        ...params,
      },
      { new: true }
    );
    return bescopeCloth;
  } catch (err) {
    return  { error: err.message };
  }
};





const validateBespokeClothes = async (product) => {
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
  if (brand ) {
    return { error: "you can not add brand to this product type" };
  }
  if (
    sizes
    
  ) {
    return { error: "you can not add size for this product type" };
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
    
if(variations){
  return { error: "bespoke products do not have variations" };
}
    return true;



};

   

module.exports = {
  validateBespokeClothes,
  editBespokeClothes
};
