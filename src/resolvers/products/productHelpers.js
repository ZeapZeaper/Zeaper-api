const { type } = require("../../config/firebaseServiceAcc");
const { colorEnums } = require("../../helpers/constants");
const { lowerFirstChar, currencyCoversion } = require("../../helpers/utils");
const ProductModel = require("../../models/products");

const getDynamicFilters = (products) => {
  const filters = [];
  const allProductTypes = products.map((product) => product.productType).sort();

  const productTypeObj = {
    name: "Product Type",
    type: "checkbox",
    options: [],
  };
  allProductTypes.forEach((productType) => {
    let value;
    if (productType === "readyMadeCloth") {
      value = "Ready Made Cloth";
    }
    if (productType === "bespokeCloth") {
      value = "Bespoke Cloth";
    }
    if (productType === "accessory") {
      value = "Accessory";
    }
    if (productType === "readyMadeShoe") {
      value = "Ready Made Shoe";
    }
    if (productType === "bespokeShoe") {
      value = "Bespoke Shoe";
    }
    const productTypeIndex = productTypeObj.options.findIndex(
      (option) => option.value === value
    );

    if (productTypeIndex === -1) {
      productTypeObj.options.push({
        value: value,

        count: 1,
      });
    } else {
      productTypeObj.options[productTypeIndex].count += 1;
    }
  });
  if (productTypeObj.options.length > 0) {
    filters.push(productTypeObj);
  }
  const allPrices = products
    .map((product) => product.variations)
    .flat()
    .map((variation) => variation.price);

  const allCategories = products.map((product) => product.categories);

  const allDesigns = allCategories
    .map((product) => product.design)
    .flat()
    .sort();
  const allStyles = allCategories
    .map((product) => product.style)
    .flat()
    .sort();

  const allColors = products
    .map((product) => product.colors)
    .flat()
    .map((color) => color.value)
    .sort();
  const allSizes = products
    .map((product) => product.sizes)
    .flat()
    .sort();
  const allBrands = allCategories
    .map((product) => product.brand)
    .flat()
    .sort();
  const allFits = allCategories
    .map((product) => product.fit)
    .flat()
    .sort();
  const allFastening = allCategories
    .map((product) => product.fastening)
    .flat()
    .sort();
  const allOccasion = allCategories
    .map((product) => product.occasion)
    .flat()
    .sort();
  const allSleeveLength = allCategories
    .map((product) => product?.sleeveLength)
    .sort();
  const allHeelHeight = allCategories
    .map((product) => product?.heelHeight)
    .sort();
  const allHeelType = allCategories.map((product) => product?.heelType).sort();
  const allAccessoryTypes = allCategories
    .map((product) => product.accessoryType)
    .sort();
  const allMains = allCategories
    .map((product) => product.main)
    .flat()
    .sort();
  const allGenders = allCategories
    .map((product) => product.gender)
    .flat()
    .sort();
  const allAgeGroups = allCategories
    .map((product) => product?.age?.ageGroup)
    .sort();
  const allAgeRanges = allCategories
    .map((product) => product?.age?.ageRange)
    .sort();
  const mainObj = {
    name: "Main",
    type: "checkbox",
    options: [],
  };
  allMains.forEach((main) => {
    if (!main) {
      return;
    }
    const mainIndex = mainObj.options.findIndex(
      (option) => option.value === main
    );
    if (mainIndex === -1) {
      mainObj.options.push({
        value: main,
        count: 1,
      });
    } else {
      mainObj.options[mainIndex].count += 1;
    }
  });

  if (mainObj.options.length > 0) {
    filters.push(mainObj);
  }
  const accessoryTypeObj = {
    name: "Accessory Type",
    type: "checkbox",
    options: [],
  };
  allAccessoryTypes.forEach((accessoryType) => {
    if (!accessoryType) {
      return;
    }
    const accessoryTypeIndex = accessoryTypeObj.options.findIndex(
      (option) => option.value === accessoryType
    );
    if (accessoryTypeIndex === -1) {
      accessoryTypeObj.options.push({
        value: accessoryType,
        count: 1,
      });
    } else {
      accessoryTypeObj.options[accessoryTypeIndex].count += 1;
    }
  });
  if (accessoryTypeObj.options.length > 0) {
    filters.push(accessoryTypeObj);
  }

  const genderObj = {
    name: "Gender",
    type: "checkbox",
    options: [],
  };
  allGenders.forEach((gender) => {
    if (!gender) {
      return;
    }

    const genderIndex = genderObj.options.findIndex(
      (option) => option.value === gender
    );
    if (genderIndex === -1) {
      genderObj.options.push({
        value: gender,
        count: 1,
      });
    } else {
      genderObj.options[genderIndex].count += 1;
    }
  });
  if (genderObj.options.length > 0) {
    filters.push(genderObj);
  }
  const ageGroupObj = {
    name: "Age Group",
    type: "checkbox",
    options: [],
  };
  allAgeGroups.forEach((ageGroup) => {
    if (!ageGroup) {
      return;
    }
    const ageGroupIndex = ageGroupObj.options.findIndex(
      (option) => option.value === ageGroup
    );
    if (ageGroupIndex === -1) {
      ageGroupObj.options.push({
        value: ageGroup,
        count: 1,
      });
    } else {
      ageGroupObj.options[ageGroupIndex].count += 1;
    }
  });
  if (ageGroupObj.options.length > 0) {
    filters.push(ageGroupObj);
  }
  const ageRangeObj = {
    name: "Age Range",
    type: "checkbox",
    options: [],
  };
  allAgeRanges.forEach((ageRange) => {
    if (!ageRange) {
      return;
    }
    const ageRangeIndex = ageRangeObj.options.findIndex(
      (option) => option.value === ageRange
    );
    if (ageRangeIndex === -1) {
      ageRangeObj.options.push({
        value: ageRange,
        count: 1,
      });
    } else {
      ageRangeObj.options[ageRangeIndex].count += 1;
    }
  });
  if (ageRangeObj.options.length > 0) {
    filters.push(ageRangeObj);
  }

  const colorObj = {
    name: "Color",
    type: "checkbox",
    options: [],
  };
  allColors.forEach((color) => {
    if (!color) {
      return;
    }
    const colorIndex = colorObj.options.findIndex(
      (option) => option.value === color
    );
    if (colorIndex === -1) {
      colorObj.options.push({
        value: color,
        count: 1,
      });
    } else {
      colorObj.options[colorIndex].count += 1;
    }
  });
  if (colorObj.options.length > 0) {
    filters.push(colorObj);
  }
  const styleObj = {
    name: "Style",
    type: "checkbox",
    options: [],
  };
  allStyles.forEach((style) => {
    if (!style) {
      return;
    }
    const styleIndex = styleObj.options.findIndex(
      (option) => option.value === style
    );
    if (styleIndex === -1) {
      styleObj.options.push({
        value: style,
        count: 1,
      });
    } else {
      styleObj.options[styleIndex].count += 1;
    }
  });
  if (styleObj.options.length > 0) {
    filters.push(styleObj);
  }

  const designObj = {
    name: "Design",
    type: "checkbox",
    options: [],
  };
  allDesigns.forEach((design) => {
    if (!design) {
      return;
    }
    const designIndex = designObj.options.findIndex(
      (option) => option.value === design
    );
    if (designIndex === -1) {
      designObj.options.push({
        value: design,
        count: 1,
      });
    } else {
      designObj.options[designIndex].count += 1;
    }
  });
  if (designObj.options.length > 0) {
    filters.push(designObj);
  }

  const sizeObj = {
    name: "Size",
    type: "checkbox",
    options: [],
  };
  allSizes.forEach((size) => {
    if (!size) {
      return;
    }
    const sizeIndex = sizeObj.options.findIndex(
      (option) => option.value === size
    );
    if (sizeIndex === -1) {
      sizeObj.options.push({
        value: size,
        count: 1,
      });
    } else {
      sizeObj.options[sizeIndex].count += 1;
    }
  });
  if (sizeObj.options.length > 0) {
    filters.push(sizeObj);
  }
  const brandObj = {
    name: "Brand",
    type: "checkbox",
    options: [],
  };
  allBrands.forEach((brand) => {
    if (!brand) {
      return;
    }
    const brandIndex = brandObj.options.findIndex(
      (option) => option.value === brand
    );
    if (brandIndex === -1) {
      brandObj.options.push({
        value: brand,
        count: 1,
      });
    } else {
      brandObj.options[brandIndex].count += 1;
    }
  });
  if (brandObj.options.length > 0) {
    filters.push(brandObj);
  }
  const fitObj = {
    name: "Fit",
    type: "checkbox",
    options: [],
  };
  allFits.forEach((fit) => {
    if (!fit) {
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
  });
  if (fitObj.options.length > 0) {
    filters.push(fitObj);
  }
  const fasteningObj = {
    name: "Fastening",
    type: "checkbox",
    options: [],
  };
  allFastening.forEach((fastening) => {
    if (!fastening) {
      return;
    }
    const fasteningIndex = fasteningObj.options.findIndex(
      (option) => option.value === fastening
    );
    if (fasteningIndex === -1) {
      fasteningObj.options.push({
        value: fastening,
        count: 1,
      });
    } else {
      fasteningObj.options[fasteningIndex].count += 1;
    }
  });
  if (fasteningObj.options.length > 0) {
    filters.push(fasteningObj);
  }
  const occasionObj = {
    name: "Occasion",
    type: "checkbox",
    options: [],
  };
  allOccasion.forEach((occasion) => {
    if (!occasion) {
      return;
    }
    const occasionIndex = occasionObj.options.findIndex(
      (option) => option.value === occasion
    );
    if (occasionIndex === -1) {
      occasionObj.options.push({
        value: occasion,
        count: 1,
      });
    } else {
      occasionObj.options[occasionIndex].count += 1;
    }
  });
  if (occasionObj.options.length > 0) {
    filters.push(occasionObj);
  }
  const sleeveLengthObj = {
    name: "Sleeve Length",
    type: "checkbox",
    options: [],
  };
  allSleeveLength.forEach((sleeveLength) => {
    if (!sleeveLength) {
      return;
    }
    const sleeveLengthIndex = sleeveLengthObj.options.findIndex(
      (option) => option.value === sleeveLength
    );
    if (!sleeveLength) {
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
  });
  if (sleeveLengthObj.options.length > 0) {
    filters.push(sleeveLengthObj);
  }
  const heelHeightObj = {
    name: "Heel Height",
    type: "checkbox",
    options: [],
  };
  allHeelHeight.forEach((heelHeight) => {
    if (!heelHeight) {
      return;
    }
    const heelHeightIndex = heelHeightObj.options.findIndex(
      (option) => option.value === heelHeight
    );
    if (heelHeightIndex === -1) {
      heelHeightObj.options.push({
        value: heelHeight,
        count: 1,
      });
    } else {
      heelHeightObj.options[heelHeightIndex].count += 1;
    }
  });
  if (heelHeightObj.options.length > 0) {
    filters.push(heelHeightObj);
  }
  const heelTypeObj = {
    name: "Heel Type",
    type: "checkbox",
    options: [],
  };
  allHeelType.forEach((heelType) => {
    if (!heelType) {
      return;
    }
    const heelTypeIndex = heelTypeObj.options.findIndex(
      (option) => option.value === heelType
    );
    if (heelTypeIndex === -1) {
      heelTypeObj.options.push({
        value: heelType,
        count: 1,
      });
    } else {
      heelTypeObj.options[heelTypeIndex].count += 1;
    }
  });
  if (heelTypeObj.options.length > 0) {
    filters.push(heelTypeObj);
  }
  const priceObj = {
    name: "Price",
    type: "range",
    options: {
      min: Math.min(...allPrices),
      max: Math.max(...allPrices),
    },
  };
  filters.push(priceObj);

  return filters;
};

const getQuery = (queries) => {
  const {
    shopId,
    productType,
    productId,
    sizes,
    title,
    description,
    colors,
    brand,
    design,
    gender,
    ageGroup,
    ageRange,
    style,
    main,
    sleeveLength,
    fastening,
    fit,
    occasion,
    price,
    status,
  } = queries;

  const match = {
    disabled: queries.disabled ? true : false,
  };

  if (shopId) {
    match.shopId = shopId;
  }
  if (productType) {
    match.productType = lowerFirstChar(productType.replace(/\s/g, ""));
  }
  if (productId) {
    match.productId = productId;
  }

  if (sizes) {
    match.sizes = { $in: sizes.replace(/\s*,\s*/g, ",").split(",") };
  }
  // use $regex to search for title and description
  if (title) {
    match.title = { $regex: title, $options: "i" };
  }
  if (description) {
    match.description = { $regex: description, $options: "i" };
  }
  if (colors) {
    match.colors = {
      $elemMatch: {
        value: { $in: colors.replace(/\s*,\s*/g, ",").split(",") },
      },
    };
  }
  //brand is child of categories object field
  if (brand) {
    match["categories.brand"] = {
      $in: brand.replace(/\s*,\s*/g, ",").split(","),
    };
  }
  if (design) {
    match["categories.design"] = {
      $in: design.replace(/\s*,\s*/g, ",").split(","),
    };
  }
  if (gender) {
    match["categories.gender"] = {
      $in: gender.replace(/\s*,\s*/g, ",").split(","),
    };
  }
  if (ageGroup) {
    match["categories.age.ageGroup"] = {
      $in: ageGroup.replace(/\s*,\s*/g, ",").split(","),
    };
  }
  if (ageRange) {
    match["categories.age.ageRange"] = {
      $in: ageRange.replace(/\s*,\s*/g, ",").split(","),
    };
  }
  if (style) {
    match["categories.style"] = {
      $in: style.replace(/\s*,\s*/g, ",").split(","),
    };
  }
  if (main) {
    match["categories.main"] = {
      $in: main.replace(/\s*,\s*/g, ",").split(","),
    };
  }
  if (sleeveLength) {
    match["categories.sleeveLength"] = {
      $in: sleeveLength.replace(/\s*,\s*/g, ",").split(","),
    };
  }
  if (fastening) {
    match["categories.fastening"] = {
      $in: fastening.replace(/\s*,\s*/g, ",").split(","),
    };
  }
  if (fit) {
    match["categories.fit"] = { $in: fit.replace(/\s*,\s*/g, ",").split(",") };
  }
  if (occasion) {
    match["categories.occasion"] = {
      $in: occasion.replace(/\s*,\s*/g, ",").split(","),
    };
  }
  if (status) {
    match.status = status;
  }
  if (price) {
    const [min, max] = price.split("-");

    match["variations.price"] = { $gte: min, $lte: max };
  }

  const query = { ...match };

  return query;
};

const verifyColorsHasImages = (colors) => {
  return colors.every((color) => {
    const { value, images } = color;

    if (!images || images.length === 0) {
      return false;
    }
    if (
      !value ||
      (colorEnums.findIndex((c) => c.name === value) === -1 &&
        value !== "Bespoke")
    ) {
      return false;
    }

    images.every((image) => {
      if (!image.link || !image.name) {
        return false;
      }
    });
    return true;
  });
};
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
};
const validateBespokeVariations = (variations) => {
  let valid = true;
  variations.every((variation) => {
    const { sku, price, colorValue } = variation;
    if (!sku || !price || !colorValue) {
      valid = false;
      return false;
    }

    if (
      !colorValue ||
      !colorEnums.findIndex((c) => c.name === colorValue) === -1
    ) {
      valid = false;
      return false;
    }
    return true;
  });

  const bespokeVariations = variations.filter(
    (variation) => variation.colorValue.toLocaleLowerCase() === "bespoke"
  );

  if (bespokeVariations.length === 0) {
    valid = false;
  }

  if (bespokeVariations.length > 1) {
    valid = false;
  }
  if (bespokeVariations.length === 1) {
    const { colorType, availableColors } = bespokeVariations[0].bespoke;
    if (!colorType || !availableColors) {
      valid = false;
    }
    if (colorType === "single" && availableColors.length === 0) {
      valid = false;
    }
    if (colorType === "multiple" && availableColors.length !== 0) {
      valid = false;
    }
  }

  return valid;
};
const addPreferredAmountAndCurrency = (products, preferredCurrency) => {
  return products.map((product) => {
    const variations = product.variations.map((variation) => {
      const { price, discount } = variation;
      const priceInPreferredCurrency = currencyCoversion(
        price,
        preferredCurrency
      );
      const discountInPreferredCurrency = currencyCoversion(
        discount,
        preferredCurrency
      );
      return {
        ...variation,
        price: priceInPreferredCurrency,
        discount: discountInPreferredCurrency,
        currency: preferredCurrency,
      };
    });
    return {
      ...product,
      variations,
    };
  });
};

module.exports = {
  getDynamicFilters,
addPreferredAmountAndCurrency,
  getQuery,
  verifyColorsHasImages,
  validateVariations,
  validateBespokeVariations,
};
