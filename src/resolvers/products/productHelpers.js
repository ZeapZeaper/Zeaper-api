const { colorEnums } = require("../../helpers/constants");
const ProductModel = require("../../models/products");

const getDynamicFilters = (products) => {
    const filters = [];
    const allProductTypes = products.map((product) => product.productType);
 
    const productTypeObj = {
        name: "Product Type",
        options: [],
    }
    allProductTypes.forEach((productType) => {
        const productTypeIndex = productTypeObj.options.findIndex((option) => option.value === productType);
        if (productTypeIndex === -1) {
            
            productTypeObj.options.push({
                value: productType,
                count: 1,
            });
        } else {
            productTypeObj.options[productTypeIndex].count += 1;
        }
    }
    );
    if (productTypeObj.options.length > 0) {
        filters.push(productTypeObj);
    }
    const allPrices = products.map((product) => product.variations).flat().map((variation) => variation.price);
  
    const priceObj = {
        name: "Price",
        options: {
            min: Math.min(...allPrices),
            max: Math.max(...allPrices),
        }
    }
    filters.push(priceObj);
    

    const allCategories = products.map((product) => product.categories);

    const allDesigns = allCategories.map((product) => product.design).flat()
    const allStyles = allCategories.map((product) => product.style).flat();

     const allColors = products.map((product) => product.colors).flat().map((color) => color.value);
     const allSizes = products.map((product) => product.sizes).flat();
     const allBrands = allCategories.map((product) => product.brand);
     const allFits = allCategories.map((product) => product.fit).flat();
     const allFastening = allCategories.map((product) => product.fastening).flat();
     const allOccasion = allCategories.map((product) => product.occasion).flat();
     const allSleeveLength = allCategories.map((product) => product?.sleeveLength)
     const allMains = allCategories.map((product) => product.main).flat();
     const allGenders = allCategories.map((product) => product.gender).flat();
     const allAgeGroups = allCategories.map((product) => product?.age?.ageGroup);
    const allAgeRanges = allCategories.map((product) => product?.age?.ageRange);

     const designObj = {
        name: "Design",
        options: [],
    }
    allDesigns.forEach((design) => {  
        if(!design){
            return;
        }  
        const designIndex = designObj.options.findIndex((option) => option.value === design);
        if (designIndex === -1) {
            designObj.options.push({
                value: design,
                count: 1,
            });
        } else {
            designObj.options[designIndex].count += 1;
        }
    }
    );
    if (designObj.options.length > 0) {
        filters.push(designObj);
    }
    const styleObj = {
        name: "Style",
        options: [],
    }
    allStyles.forEach((style) => {
        if(!style){
            return;
        }
        const styleIndex = styleObj.options.findIndex((option) => option.value === style);
        if (styleIndex === -1) {
            styleObj.options.push({
                value: style,
                count: 1,
            });
        } else {
            styleObj.options[styleIndex].count += 1;
        }
    }
    );
    if (styleObj.options.length > 0) {
        filters.push(styleObj);
    }
    const colorObj = {
        name: "Color",
        options: [],
    }
    allColors.forEach((color) => {
        if(!color){
            return;
        }
        const colorIndex = colorObj.options.findIndex((option) => option.value === color);
        if (colorIndex === -1) {
            colorObj.options.push({
                value: color,
                count: 1,
            });
        } else {
            colorObj.options[colorIndex].count += 1;
        }
    }
    );
    if (colorObj.options.length > 0) {
        filters.push(colorObj);
    }
    const sizeObj = {
        name: "Size",
        options: [],
    }
    allSizes.forEach((size) => {
        if(!size){
            return;
        }
        const sizeIndex = sizeObj.options.findIndex((option) => option.value === size);
        if (sizeIndex === -1) {
            sizeObj.options.push({
                value: size,
                count: 1,
            });
        } else {
            sizeObj.options[sizeIndex].count += 1;
        }
    }
    );
    if (sizeObj.options.length > 0) {
        filters.push(sizeObj);
    }
    const brandObj = {
        name: "Brand",
        options: [],
    }
    allBrands.forEach((brand) => {
        if(!brand){
            return;
        }
        const brandIndex = brandObj.options.findIndex((option) => option.value === brand);
        if (brandIndex === -1) {
            brandObj.options.push({
                value: brand,
                count: 1,
            });
        } else {
            brandObj.options[brandIndex].count += 1;
        }
    }
    );
    if (brandObj.options.length > 0) {
        filters.push(brandObj);
    }
    const fitObj = {
        name: "Fit",
        options: [],
    }
    allFits.forEach((fit) => {
        if(!fit){
            return;
        }
        const fitIndex = fitObj.options.findIndex((option) => option.value === fit);
        if (fitIndex === -1) {
            fitObj.options.push({
                value: fit,
                count: 1,
            });
        } else {
            fitObj.options[fitIndex].count += 1;
        }
    }
    );
    if (fitObj.options.length > 0) {
        filters.push(fitObj);
    }
    const fasteningObj = {
        name: "Fastening",
        options: [],
    }
    allFastening.forEach((fastening) => {
        if(!fastening){
            return;
        }
        const fasteningIndex = fasteningObj.options.findIndex((option) => option.value === fastening);
        if (fasteningIndex === -1) {
            fasteningObj.options.push({
                value: fastening,
                count: 1,
            });
        } else {
            fasteningObj.options[fasteningIndex].count += 1;
        }
    }
    );
    if (fasteningObj.options.length > 0) {
        filters.push(fasteningObj);
    }
    const occasionObj = {
        name: "Occasion",
        options: [],
    }
    allOccasion.forEach((occasion) => {
        if(!occasion){
            return;
        }
        const occasionIndex = occasionObj.options.findIndex((option) => option.value === occasion);
        if (occasionIndex === -1) {
            occasionObj.options.push({
                value: occasion,
                count: 1,
            });
        } else {
            occasionObj.options[occasionIndex].count += 1;
        }
    }
    );
    if (occasionObj.options.length > 0) {
        filters.push(occasionObj);
    }
    const sleeveLengthObj = {
        name: "Sleeve Length",
        options: [],
    }
    allSleeveLength.forEach((sleeveLength) => {
        if(!sleeveLength){
            return;
        }
        const sleeveLengthIndex = sleeveLengthObj.options.findIndex((option) => option.value === sleeveLength);
        if(!sleeveLength){
            return;
        }
        if (sleeveLengthIndex === -1) {
            sleeveLengthObj.options.push({
                value: sleeveLength,
                count: 1,
            });
        } else {
            sleeveLengthObj.options[sleeveLengthIndex].count += 1;
        }
    }
    );
    if (sleeveLengthObj.options.length > 0) {
        filters.push(sleeveLengthObj);
    }
    const mainObj = {
        name: "Main",
        options: [],
    }
    allMains.forEach((main) => {
        if(!main){
            return;
        }
        const mainIndex = mainObj.options.findIndex((option) => option.value === main);
        if (mainIndex === -1) {
            mainObj.options.push({
                value: main,
                count: 1,
            });
        } else {
            mainObj.options[mainIndex].count += 1;
        }
    }
    );

    if (mainObj.options.length > 0) {
        filters.push(mainObj);
    }

    const genderObj = {
        name: "Gender",
        options: [],
    }
    allGenders.forEach((gender) => {
        if
        (!gender){
            return;
        }
       
        const genderIndex = genderObj.options.findIndex((option) => option.value === gender);
        if (genderIndex === -1) {
            genderObj.options.push({
                value: gender,
                count: 1,

            });
        } else
        {
            genderObj.options[genderIndex].count += 1;
        }
    }
    );
    if (genderObj.options.length > 0) {
        filters.push(genderObj);
    }
    const ageGroupObj = {
        name: "Age Group",
        options: [],
    }
    allAgeGroups.forEach((ageGroup) => {
        if(!ageGroup){
            return;
        }
        const ageGroupIndex = ageGroupObj.options.findIndex((option) => option.value === ageGroup);
        if (ageGroupIndex === -1) {
            ageGroupObj.options.push({
                value: ageGroup,
                count: 1,
            });
        } else {
            ageGroupObj.options[ageGroupIndex].count += 1;
        }
    }
    );
    if (ageGroupObj.options.length > 0) {
        filters.push(ageGroupObj);
    }
    const ageRangeObj = {
        name: "Age Range",
        options: [],
    }
    allAgeRanges.forEach((ageRange) => {
        if(!ageRange){
            return;
        }
        const ageRangeIndex = ageRangeObj.options.findIndex((option) => option.value === ageRange);
        if (ageRangeIndex === -1) {
            ageRangeObj.options.push({
                value: ageRange,
                count: 1,
            });
        } else {
            ageRangeObj.options[ageRangeIndex].count += 1;
        }
    }
    );
    if (ageRangeObj.options.length > 0) {
        filters.push(ageRangeObj);
    }


   
   
   
   return filters;
   }


   const deleteRestoreProducts = async (
    productIds,
    userId,
    disabledValue
  ) => {
    return productIds.reduce(async (acc, _id) => {
      const result = await acc;
  
      const disabled = await ProductModel.findByIdAndUpdate(
        _id,
        { disabled: disabledValue },
        { new: true }
      );
  
      if (disabled) {
        result.push(_id);
      }
  
      return result;
    }, []);
  };
  const deleteProductsById = async (param) => {
    try {
      const { productIds, userId } = param;
      const deletedProducts = await deleteRestoreProducts(
        productIds,
        userId,
        true
      );
      return deletedProducts;
    } catch (err) {
      return res.status(500).send({ error: err.message });
    }
  };
  const restoreProductsById = async (param) => {
    try {
      const { productIds, userId } = param;
      const restoredProducts = await deleteRestoreReadyMadeClothes(
        productIds,
        userId,
        false
      );
      return restoredProducts;
    } catch (err) {
      return res.status(500).send({ error: err.message });
    }
  };


  const getQuery = (queries)=>{
    const { lastSeen_id,shopId,  productType, productId, sizes,title,description,colors,brand,design,gender,ageGroup,ageRange,
         style,main,sleeveLength,fastening,fit,occasion,price
    } = queries;
  
  
   
      const match = {
        disabled: queries.disabled ? queries.disabled : false,  
      };
      if(lastSeen_id){
        match._id = { $lt: lastSeen_id }
      }
      if(shopId){
        match.shopId = shopId;
      }
      if(productType){
        match.productType = productType;
      }
      if(productId){
        match.productId = productId;
      }
     
      if(sizes){
        console.log("sizes", sizes);
        match.sizes = { $in: sizes.replace(/\s*,\s*/g, ',').split(",") };
      }
      // use $regex to search for title and description
      if(title){
        match.title = { $regex: title, $options: "i" };
      }
      if(description){
        match.description = { $regex: description, $options: "i" };
      }
      if(colors){
        match.colors = { $elemMatch: { value: { $in: colors.replace(/\s*,\s*/g, ',').split(",") } } };
      }
      //brand is child of categories object field
      if(brand){
        match["categories.brand"] = { $in: brand.replace(/\s*,\s*/g, ',').split(",") };
      }
      if(design){
        match["categories.design"] = { $in: design.replace(/\s*,\s*/g, ',').split(",") };
      }
      if(gender){
        match["categories.gender"] = { $in: gender.replace(/\s*,\s*/g, ',').split(",") };
      }
      if(ageGroup){
        match["categories.age.ageGroup"] = { $in: ageGroup.replace(/\s*,\s*/g, ',').split(",") };
      }
      if(ageRange){
        match["categories.age.ageRange"] = { $in: ageRange.replace(/\s*,\s*/g, ',').split(",") };
      }
      if(style){
        match["categories.style"] = { $in: style.replace(/\s*,\s*/g, ',').split(",") };
      }
      if(main){
        match["categories.main"] = { $in: main.replace(/\s*,\s*/g, ',').split(",") };
      }
      if(sleeveLength){
        match["categories.sleeveLength"] = { $in: sleeveLength.replace(/\s*,\s*/g, ',').split(",") };
      }
      if(fastening){
        match["categories.fastening"] = { $in: fastening.replace(/\s*,\s*/g, ',').split(",") };
      }
      if(fit){
        match["categories.fit"] = { $in: fit.replace(/\s*,\s*/g, ',').split(",") };
      }
      if(occasion){
        match["categories.occasion"] = { $in: occasion.replace(/\s*,\s*/g, ',').split(",") };
      }
        if(price){
            const [min, max] = price.split("-");
            console.log("min", min);
            console.log("max", max);
            match["variations.price"] = { $gte: min, $lte: max };
        }

  
  
      const query = { ...match };
        return query;
  }

  const verifyColorsHasImages = (colors) => {
    return colors.every((color) => {
      const { value,images } = color;
      if (!images || images.length === 0) {
        return false;
      }
      if (!value  || colorEnums.findIndex((c) => c.name === value) === -1) {
        return false;
      }
    
    images.every((image) => {
        if (!image.link || !image.name) {
      
          return false;
        }
      
      }
      
      
      
      );
      return true;
     
    });
  }
  const validateVariations = (variations, sizes, colors) => {
  
    if (!variations || variations.length === 0) {
      return false;
    }
    return variations.every((variation) => {
      const { size, colorValue, price, quantity } = variation;
      if (!sizes.includes(size)) {
        return false;
      }
      if (!colors.map((color) => color.value).includes(colorValue)) {
        return false;
      }
      if (typeof price !== "number" || price < 0) {
        return false;
      }
      if (typeof quantity !== "number" || quantity < 0) {
        return false;
      }
      return true;
    });
  
  }
   
   module.exports = {
    getDynamicFilters,
    deleteProductsById,
    restoreProductsById,
    getQuery,
    verifyColorsHasImages,
    validateVariations
   };