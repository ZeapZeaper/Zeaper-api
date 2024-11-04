const {
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
  brandEnums,mainEnums, colorEnums
} = require("../../helpers/constants");
const { checkForDuplicates, deleteLocalFile } = require("../../helpers/utils");
const ReadyMadeClothes = require("../../models/products/readyMadeCloth");
const ReadyMadeShoes = require("../../models/products/readyMadeShoes");
const ShopModel = require("../../models/shop");
const { v4: uuidv4 } = require("uuid");
const sharp = require("sharp");
const path = require("path");
const {
  editReadyMadeClothes,
  deleteReadyMadeClothes,
  restoreReadyMadeClothes,
  createReadyMadeClothes,
  validateReadyMadeClothes,
  addVariationToReadyMadeClothes,
} = require("./readyMadeClothes");
const { storageRef } = require("../../config/firebase");
const root = require("../../../root");
const { getAuthUser } = require("../../middleware/firebaseUserAuth");


//saving image to firebase storage
const addImage = async (destination, filename) => {
  
  let url = {};
  if (filename) {
    const source = path.join(root + "/uploads/" + filename);
    await sharp(source)
    .resize(1500, 1500, {
      fit: "inside",  
      withoutEnlargement: true,
    })
      // .jpeg({ quality: 90 })
      .toFile(path.resolve(destination, "resized", filename));
    
    const storage = await storageRef.upload(
       path.resolve(destination, "resized", filename),
      // path.resolve(source),
      {
        public: true,
        destination: `/product/${filename}`,
        metadata: {
          firebaseStorageDownloadTokens: uuidv4(),
        },
      }
    );
    url = {
      link: storage[0].metadata.mediaLink,
      name: filename
     
    };
    const deleteSourceFile = await deleteLocalFile(source);
    const deleteResizedFile = await deleteLocalFile(
      path.resolve(destination, "resized", filename)
    );
    await Promise.all([deleteSourceFile, deleteResizedFile]);
    return url;
  }
  return url;
};

const deleteImageFromFirebase = async (name) => {
  if (name) {
    storageRef
      .file("/product/" + name)
      .delete()
      .then(() => {
        return true;
      })
      .catch((err) => {

        return false;
      });
  }
};

const handleImageUpload = async (files) => {
  const newPictures = [];
  if (files) {
    for (let i = 0; i < files?.length; i++) {
      const file = files[i];

      const filename = file.filename;
      const destination = file.destination;
      // const originalname = file.originalname;

      const url = await addImage(destination, filename);

      newPictures.push(url);
    }
  }

  return newPictures;
};

const handleImageDelete = async (images) => {
  if (images) {
    for (let i = 0; i < images?.length; i++) {
      const image = images[i];
      const name = image.name;
      await deleteImageFromFirebase(name);
    }
  }
};
const deleLocalImages = async (files) => {
  for (let i = 0; i < files?.length; i++) {
       
    const file = files[i];
    const source = path.join(root + "/uploads/" + file.filename);
 
    const deleteSourceFile = await deleteLocalFile(source);
  }
};
const addProductColorAndImages = async (req, res) => {
  try{
    const files = req.files.images
    if (req.fileValidationError) {
      await deleLocalImages(files);
     
      return res.status(400).send({ error: req.fileValidationError });
    }
    //if files is more than 5
    if (files.length > 5) {
      await deleLocalImages(files);
      return res.status(400).send({ error: "You can only upload a maximum of 5 images for each color" });
    }
    
    const {productId, color} = req.body;
    console.log("req.body", req.body);
    if (!productId) {
      await deleLocalImages(files);
      return res.status(400).send({ error: "productId is required" });
    }
   
    if (!color) {
      await deleLocalImages(files);
      return res.status(400).send({ error: "color is required" });
    }
    
    if(colorEnums.indexOf(color) === -1){
      await deleLocalImages(files);
      return res.status(400).send({ error: "invalid color value" });
    }
   
    const product = await getProductByProductId(productId);
    if (!product) {
      await deleLocalImages(files);
      return res.status(400).send({ error: "product not found" });
    }
    // check if color already exist
   
    const colorExist = product.colors.find((c) => c.value === color);
    if (colorExist) {
      await deleLocalImages(files);
      return res.status(400).send({ error: "color already exist" });
    }
    const user = await getAuthUser(req);
    if(user.shopId !== product.shopId && !user?.isAdmin && !user?.isSuperAdmin){
      await deleLocalImages(files);
      return res.status(400).send({ error: "You are not authorized to edit this product" });
    }
    if(!files || files.length === 0){
      await deleLocalImages(files);
      return res.status(400).send({ error: "pictures are required for each color" });
    }
   
    let images = [{}];

    if (files && files.length > 0) {
      const upload = await handleImageUpload([...files]);

      const docs = await Promise.all(upload);
      images = docs;
    }
 
    const colors = product.colors;
    //array of color images
    const colorImages = colors.map((color) => color.images).flat();

//check if any image is isDefault
    const isDefault = colorImages.find((image) => image.isDefault);
    if(isDefault){
      images[0].isDefault = false;
    }
    else{
      images[0].isDefault = true;
    }

    
    const newColor = {
      value : color,
      images
     
    };

    
    const productType = product.productType;
    let updatedProduct;
    if (productType === "readyMadeCloth") {
      updatedProduct = await ReadyMadeClothes.findOneAndUpdate
        ({ productId }, { $push: { colors: newColor } }, { new: true }).exec();
   
  }
  if(!updatedProduct){
    await handleImageDelete(images);
    return res.status(400).send({ error: "product not found" });
  }
  return res.status(200).send({ data: updatedProduct, message: "product updated successfully" });

  }
  catch(err){
    return res.status(500).send({ error: err.message });
  }
}
const addImagesToProductColor = async (req, res) => {
  try{
  
    const files = req.files.images
    if (req.fileValidationError) {
      
      await deleLocalImages(files);
     
      return res.status(400).send({ error: req.fileValidationError });
    }   
    

    //if files is more than 5
    if (files.length > 5) {
      await deleLocalImages(files);
      return res.status(400).send({ error: "You can only upload a maximum of 5 images for each color" });
    }
    
    const {productId, color} = req.body;
    if (!productId) {
      await deleLocalImages(files);
      return res.status(400).send({ error: "productId is required" });
    }
 
   
    if (!color) {
      await deleLocalImages(files);
      return res.status(400).send({ error: "color is required" });
    }
    
    if(colorEnums.indexOf(color) === -1){
      await deleLocalImages(files);
      return res.status(400).send({ error: "invalid color value" });
    }
   
    const product = await getProductByProductId(productId);
    if (!product) {
      await deleLocalImages(files);
      return res.status(400).send({ error: "product not found" });
    }
    // check if color already exist
   
    const colorExist = product.colors.find((c) => c.value === color);
    if (!colorExist) {
      await deleLocalImages(files);
      return res.status(400).send({ error: "color not found" });
    }
    const user = await getAuthUser(req);
    if(user.shopId !== product.shopId && !user?.isAdmin && !user?.isSuperAdmin){
      await deleLocalImages(files);
      return res.status(400).send({ error: "You are not authorized to edit this product" });
    }
   const previousImages = colorExist.images;
   if([...previousImages, ...files].length > 5){
    await deleLocalImages(files);
    return res.status(400).send({ error: "You can only upload a maximum of 5 images for each color" });
    }

   
    let images = [{}];

    if (files && files.length > 0) {
      const upload = await handleImageUpload([...files]);

      const docs = await Promise.all(upload);
      images = docs;
    }
    const colors = product.colors;
    //array of color images
    const colorImages = colors.map((color) => color.images).flat();

//check if any image is isDefault
    const isDefault = colorImages.find((image) => image.isDefault);
    if(!isDefault){
      images[0].isDefault = true
    }
   
    
    let updatedProduct;
    if (product.productType === "readyMadeCloth") {
     updatedProduct = await ReadyMadeClothes.findOneAndUpdate
      ({ productId, "colors.value": color }, { $push: { "colors.$.images": images } }, { new: true }).exec();
    }
    if (!updatedProduct) {
      await handleImageDelete(images);
      return res.status(400).send({ error: "product not found" });
    }
    return res.status(200).send({ data: updatedProduct, message: "product updated successfully" });
 
   
}
catch(err){
  return res.status(500).send({ error: err.message });
}
}
const deleteProductColor = async (req, res) => {
  try{
    const {productId, color} = req.body;
    if (!productId) {
      return res.status(400).send({ error: "productId is required" });
    }
    if (!color) {
      return res.status(400).send({ error: "color is required" });
    }
    const product = await getProductByProductId(productId);
    if (!product) {
      return res.status(400).send({ error: "product not found" });
    }
    const user = await getAuthUser(req);
    if(user.shopId !== product.shopId && !user?.isAdmin && !user?.isSuperAdmin){
      return res.status(400).send({ error: "You are not authorized to edit this product" });
    }
    const colors = product.colors;
    const colorExist = colors.find((c) => c.value === color);
    if (!colorExist) {
      return res.status(400).send({ error: "color not found" });
    }
    const colorImages = colorExist.images;
    const images = colorImages.map((image) => image.name);
    const isDefault = colorImages.find((image) => image.isDefault);
    if(isDefault && colors.length > 1){
      return res.status(400).send({ error: "There is a default image for this color. set another image as default before deleting this color" });
    }
    let updatedProduct;
    if (product.productType === "readyMadeCloth") {
     updatedProduct = await ReadyMadeClothes.findOneAndUpdate
      ({ productId }, { $pull: { colors: { value: color } } }, { new: true }).exec();
    }
    if (!updatedProduct) {
      return res.status(400).send({ error: "product not found" });
    }
    await handleImageDelete(colorImages);
    return res.status(200).send({ data: updatedProduct, message: "product updated successfully" });
  }
  catch(err){
    return res.status(500).send({ error: err.message });
  }
}
const deleteProductImage = async (req, res) => {
  try{
    const {productId, color, imageName} = req.body;
    if (!productId) {
      return res.status(400).send({ error: "productId is required" });
    }
    if (!color) {
      return res.status(400).send({ error: "color is required" });
    }
    if (!imageName) {
      return res.status(400).send({ error: "name of the image you want to delete is required" });
    }
    const product = await getProductByProductId(productId);
    if (!product) {
      return res.status(400).send({ error: "product not found" });
    }
    const user = await getAuthUser(req);
    if(user.shopId !== product.shopId && !user?.isAdmin && !user?.isSuperAdmin){
      return res.status(400).send({ error: "You are not authorized to edit this product" });
    }
    const colors = product.colors;
    const colorExist = colors.find((c) => c.value === color);
    if (!colorExist) {
      return res.status(400).send({ error: "color not found" });
    }
    const colorImages = colorExist.images;
    const imageExist = colorImages.find((image) => image.name === imageName);
    if (!imageExist) {
      return res.status(400).send({ error: "image not found" });
    }
    const isDefault = imageExist.isDefault;
    if(isDefault && (colorImages.length > 1 || colors.length > 1)){
      return res.status(400).send({ error: "This is a default image for this product. set another image as default before deleting this image" });
    }
    let updatedProduct;
    if (product.productType === "readyMadeCloth") {
     updatedProduct = await ReadyMadeClothes.findOneAndUpdate
      ({ productId, "colors.value": color }, { $pull: { "colors.$.images": { name: imageName } } }, { new: true }).exec();
    }
    if (!updatedProduct) {
      return res.status(400).send({ error: "product not found" });
    }
    await deleteImageFromFirebase(imageName);
    return res.status(200).send({ data: updatedProduct, message: "product updated successfully" });
  }
  catch(err){
    return res.status(500).send({ error: err.message });
  }
}
const setProductImageAsDefault = async (req, res) => {
  try{
    const {productId, color, imageName} = req.body;
    if (!productId) {
      return res.status(400).send({ error: "productId is required" });
    }
    if (!color) {
      return res.status(400).send({ error: "color is required" });
    }
    if (!imageName) {
      return res.status(400).send({ error: "name of the image you want to set as default is required" });
    }
    const product = await getProductByProductId(productId);
    if (!product) {
      return res.status(400).send({ error: "product not found" });
    }
    const user = await getAuthUser(req);
    if(user.shopId !== product.shopId && !user?.isAdmin && !user?.isSuperAdmin){
      return res.status(400).send({ error: "You are not authorized to edit this product" });
    }
    const colors = product.colors;
    const colorExist = colors.find((c) => c.value === color);
    if (!colorExist) {
      return res.status(400).send({ error: "color not found" });
    }
    const colorImages = colorExist.images;
    const imageExist = colorImages.find((image) => image.name === imageName);
    if (!imageExist) {
      return res.status(400).send({ error: "image not found" });
    }
    if(imageExist.isDefault){
      return res.status(400).send({ error: "This image is already set as default" });
    }
    // set all other images as not default
    const newColors = colors.map((c) => {
      if(c.value === color){
        c.images = c.images.map((image) => {
          if(image.name === imageName){
            image.isDefault = true;
          }
          else{
            image.isDefault = false;
          }
          return image;
        })
      }
      return c;
    }
    );
    let updatedProduct;
    if (product.productType === "readyMadeCloth") {
     updatedProduct = await ReadyMadeClothes.findOneAndUpdate 
      ({ productId }, { colors: newColors }, { new: true }).exec();
    }
    if (!updatedProduct) {
      return res.status(400).send({ error: "product not found" });
    }
    return res.status(200).send({ data: updatedProduct, message: "product updated successfully" });

  }
  catch(err){
    return res.status(500).send({ error: err.message });
  }
}

const editProduct = async (req, res) => {
  try {
    const{productId, title, description} = req.body;
   
   
    if (!productId) {
      return res.status(400).send({ error: "productId is required" });
    }
    const product = await getProductByProductId(productId);
    if (!product) {
      return res.status(400).send({ error: "product not found" });
    }
    if(req.body.productType && req.body.productType !== product.productType){
      return res.status(400).send({ error: "productType cannot be edited. delete and create a new product with correct product type instead" });
    }
    if(req.body.shopId && req.body.shopId !== product.shopId){
      return res.status(400).send({ error: "shopId cannot be edited. delete and create a new product with correct shopId instead" });
    }

    if(title && title == ""){
      return res.status(400).send({ error: "title is required" });
    }
    if(description && description == ""){
      return res.status(400).send({ error: "description is required" });
    }
    const user = await getAuthUser(req);
    if(user.shopId !== product.shopId && !user?.isAdmin && !user?.isSuperAdmin){
      return res.status(400).send({ error: "You are not authorized to edit this product" });
    }
    if(product?.status !== "draft" && !user?.isAdmin && !user?.isSuperAdmin){
      return res.status(400).send({ error: "You are not authorized to edit this product" });
    }
    const productType = product.productType;
    let updatedProduct;
    if (productType === "readyMadeCloth") {
      updatedProduct = await editReadyMadeClothes(req);
    }
    if (productType === "readyMadeShoe") {
      // updatedProduct = await editReadyMadeShoes(req.body);
    }
    if (updatedProduct?.error) {
      return res.status(400).send({ error: updatedProduct.error });
    }
    return res.status(200).send({ data: updatedProduct, message: "product updated successfully" });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};
const deleteProducts = async (req, res) => {
  try {
    const param = req.body;
    const { productIds } = param;
    if (!productIds || !productIds.length) {
      return res.status(400).send({ error: "productid is required" });
    }

    const promises = [];
    promises.push(
      deleteReadyMadeClothes(param)
      //   deleteReadyMadeShoes(param)
    );
    await Promise.all(promises);
    return res.status(200).send({ message: "products deleted successfully" });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

const restoreProducts = async (req, res) => {
  try {
    const param = req.body;
    const { productIds } = param;
    if (!productIds || !productIds.length) {
      return res.status(400).send({ error: "productid is required" });
    }

    const promises = [];
    promises.push(
      restoreReadyMadeClothes(param)
      //   deleteReadyMadeShoes(param)
    );
    await Promise.all(promises);
    return res.status(200).send({ message: "products restored successfully" });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};
function getRandomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}
const getProuctTypePrefix = (productType) => {
  if (productType === "readyMadeCloth") {
    return "RMC";
  }
  if (productType === "readyMadeShoe") {
    return "RMS";
  }
  return "";
};
const generateProductId = async (shopId, productType) => {
  let productId = "";
  let found = true;
  const promises = [];

  do {
    productId = `${shopId}/${getProuctTypePrefix(productType)}/${getRandomInt(
      1000000,
      9999999
    )}`;
    promises.push(ReadyMadeClothes.findOne({ productId }).exec());
    promises.push(ReadyMadeShoes.findOne({ productId }).exec());
    const [readyMadeCloth, readyMadeShoe] = await Promise.all(promises);
    if (!readyMadeCloth && !readyMadeShoe) {
      found = false;
    }
  } while (found);
  return productId;
};



const createProduct = async (req, res) => {
  try {
   
    const {
      productType,
      title,
      description,
      subTitle, 
      shopId,
    } = req.body;

    if (!productType) {
      return res.status(400).send({ error: "Product Type is required" });
    }
    if (productTypeEnums.indexOf(productType) === -1) {
      return res.status(400).send({ error: "invalid productType" });
    }
    if (!title) {
      return res.status(400).send({ error: "title is required" });
    }
    
    if (!description) {
      return res.status(400).send({ error: "description is required" });
    }

    
    const user = await getAuthUser(req);
    if(shopId && user.shopId !== shopId && !user?.isAdmin && !user?.isSuperAdmin){
      return res.status(400).send({ error: "You are not authorized to create product for this shop" });
    }

    if (!user?.shopId && !shopId) {
      return res.status(400).send({ error: "User does not have a shop" });
    }
    if (!user?.shopEnabled) {
      return res.status(400).send({ error: "User's shop is disabled" });
    }
    const shop = await ShopModel.findOne({ shopId: shopId || user.shopId });
    if (!shop) {
      return res.status(400).send({ error: "shop not found" });
    }
    

    const productId = await generateProductId(user.shopId, productType);
    const param = {
      title,
      subTitle,
      description,
      productType,
      shopId : shopId|| user.shopId,
      productId,
      postedBy: user._id,
      shop: shop._id,

    }

   
    // param.images = images;
    let createdProduct;
    if (productType === "readyMadeCloth") {
      createdProduct = await createReadyMadeClothes(param);
    }
    if (productType === "readyMadeShoe") {
      // createdProduct = await createReadyMadeShoes(param);
    }

    return res
      .status(200)
      .send({ data: createdProduct, message: "product created successfully" });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};
const setProductStatus = async (req, res) => {
  try{
    const { productId, status } = req.body;
    if (!productId) {
      return res.status(400).send({ error: "productId is required" });
    }
 
    if (statusEnums.indexOf(status) === -1) {
      return res.status(400).send({ error: "invalid status" });
    }
    const product = await getProductByProductId(productId);
    if (!product) {
      return res.status(400).send({ error: "product not found" });
    }
    const productType = product.productType
    if(status === "under review" &&  productType === "readyMadeCloth"){
      const verify = await validateReadyMadeClothes(product);
      if(verify){
        return res.status(400).send({ error: verify.error });
      }
      const updatedProduct = await ReadyMadeClothes.findOneAndUpdate( { productId }, { status }, { new: true }).exec();
      return res.status(200).send({ data: updatedProduct, message: "product status updated successfully" });
    }

  }
  catch(err){
    return res.status(500).send({ error: err.message });
  }

};
const submitProduct = async (req, res) => {
  try{
    const { productId } = req.body;
   
    if (!productId) {
      return res.status(400).send({ error: "productId is required" });
    }
    const product = await getProductByProductId(productId);
    if (!product) {
      return res.status(400).send({ error: "product not found" });
    }
    const productType = product.productType;
    let updatedProduct;
  
    if(productType === "readyMadeCloth"){
      const verify = await validateReadyMadeClothes(product);
      if(verify?.error){
        return res.status(400).send({ error: verify.error });
      }

      updatedProduct = await ReadyMadeClothes.findOneAndUpdate( { productId }, { status: "under review" }, { new: true }).exec();
    }
     
   if(!updatedProduct){
    return res.status(400).send({ error: "product not found" });
  }
  return res.status(200).send({ data: updatedProduct, message: "product submitted successfully" });
  }
  catch(err){
    return res.status(500).send({ error: err.message });
  }
}

const getProductByProductId = async (productId) => {
  const promises = [];
  promises.push(ReadyMadeClothes.findOne({
    productId,
  }).exec());
  promises.push(ReadyMadeShoes.findOne
    ({
      productId,
    }).exec());
  const [readyMadeCloth, readyMadeShoe] = await Promise.all(promises);
  if (readyMadeCloth) {
    return readyMadeCloth;
  }
  if (readyMadeShoe) {
    return readyMadeShoe;
  }
  return null;
}
const getProductByShopId = async (shopId) => {
  const promises = [];
  promises.push(ReadyMadeClothes.find
    ({
      shopId,
    }).exec());
  promises.push(ReadyMadeShoes.find
    ({
      shopId,
    }).exec());
  const [readyMadeCloth, readyMadeShoe] = await Promise.all(promises);
  if (readyMadeCloth) {
    return readyMadeCloth;
  }
  if (readyMadeShoe) {
    return readyMadeShoe;
  }
  return null;
}
const getProductByCategory = async (category) => {
  const promises = [];
  promises.push(ReadyMadeClothes.find
    ({
      category,
    }).exec());
  promises.push(ReadyMadeShoes.find
    ({
      category,
    }).exec());
  const [readyMadeCloth, readyMadeShoe] = await Promise.all(promises);
  if (readyMadeCloth) {
    return readyMadeCloth;
  }
  if (readyMadeShoe) {
    return readyMadeShoe;
  }
  return null;
}
const getProduct = async (req, res) => {
  try {
    const { productId } = req.query;
    if (!productId) {
      return res.status(400).send({ error: "productId is required" });
    }
    const product = await getProductByProductId(productId);
    if (!product) {
      return res.status(400).send({ error: "product not found" });
    }
    const shop = await ShopModel.findById(product.shop).exec();
    const currency = shop?.currency;
    product._doc.currency = currency;
    return res.status(200).send({ data: product });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};
const getProductById = async (req, res) => {
  try{
    const { _id } = req.query;
    if (!_id) {
      return res.status(400).send({ error: "_id is required" });
    }
    const promises = [];
    promises.push(ReadyMadeClothes.findById(_id).exec());
    promises.push(ReadyMadeShoes.findById (_id).exec());
    const [readyMadeCloth, readyMadeShoe] = await Promise.all(promises);
    if (readyMadeCloth) {
      const shop = await ShopModel.findById(readyMadeCloth.shop).exec();
      const currency = shop?.currency;
     
      readyMadeCloth._doc.currency = currency;

      
      return res.status(200).send({ data: readyMadeCloth });
    }
    if (readyMadeShoe) {
      const shop = await ShopModel.findById(readyMadeShoe.shop).exec();
      const currency = shop?.currency;
      readyMadeShoe._doc.currency = currency;
      return res.status(200).send({ data: readyMadeShoe });
    }
    return res.status(400).send({ error: "product not found" });
    


  }
  catch(err){
    return res.status(500).send({ error: err.message });
  }

}


const getShopProducts = async (req, res) => {
  try {
    const { shopId } = req.query;
    if (!shopId) {
      return res.status(400).send({ error: "shopId is required" });
    }
    const products = await getProductByShopId(shopId);
    if (!products) {
      return res.status(400).send({ error: "products not found" });
    }
    return res.status(200).send({ data: products });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};
const getCategoryProducts = async (req, res) => {
  try {
    const { category } = req.query;
    if (!category) {
      return res.status(400).send({ error: "category is required" });
    }
    const products = await getProductByCategory(category);
    if (!products) {
      return res.status(400).send({ error: "products not found" });
    }
    return res.status(200).send({ data: products });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};
const getProducts = async (req, res) => {
  try {
    const pomises = [];
    pomises.push(ReadyMadeClothes.find().populate("shop").populate("postedBy").exec());
    pomises.push(ReadyMadeShoes.find().exec());
    const [readyMadeClothes, readyMadeShoes] = await Promise.all(pomises);
    return res.status(200).send({ data: { readyMadeClothes, readyMadeShoes } });

  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};
const getShopDraftProducts = async (req, res) => {
  try {
    const { shopId } = req.query;
    if (!shopId) {
      return res.status(400).send({ error: "shopId is required" });
    }
    const promises = [];
    promises.push(ReadyMadeClothes.find({ shopId, status: "draft" }).exec());
    promises.push(ReadyMadeShoes.find({ shopId, status: "draft" }).exec());
    const [readyMadeClothes, readyMadeShoes] = await Promise.all(promises);
    const data = [...readyMadeClothes, ...readyMadeShoes];
    
    return res.status(200).send({ data: data, message: "Draft products fetched successfully" });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
}
const getProductOptions = async (req, res) => {
  try {
    
    const readyMadeClothesParams = {
      mainEnums: mainEnums.sort(),
      genderEnums: genderEnums.sort(),
      ageGroupEnums: ageGroupEnums.sort(),
      ageRangeEnums: ageRangeEnums.sort(),
      statusEnums: statusEnums.sort(),
      styleEnums: styleEnums.sort(),
      sleeveLengthEnums: sleeveLengthEnums.sort(),
      designEnums: designEnums.sort(),
      fasteningEnums: fasteningEnums.sort(),
      occasionEnums: occasionEnums.sort(),
      fitEnums: fitEnums.sort(),
      brandEnums: brandEnums.sort(),
      sizeEnums: sizeEnums.sort(),
      colorEnums: colorEnums.sort(),
    }
    res.status(200).send({ data: {
      readyMadeClothes: readyMadeClothesParams,
      productTypeEnums: productTypeEnums,
    } });
  }
  catch (err) {
    return res.status(500).send({ error: err.message });
  }
}
const addProductVariation = async (req, res) => {
  try {
    const { productId, variation } = req.body;
    if (!productId) {
      return res.status(400).send({ error: "productId is required" });
    }
    if (!variation) {
      return res.status(400).send({ error: "variation is required" });
    }
    const product = await getProductByProductId(productId);
    if (!product) {
      return res.status(400).send({ error: "product not found" });
    }
    const user = await getAuthUser(req);
    if(user.shopId !== product.shopId && !user?.isAdmin && !user?.isSuperAdmin){
      return res.status(400).send({ error: "You are not authorized to edit this product" });
    }
    const productType = product.productType;
    let updatedProduct;
    if (productType === "readyMadeCloth") {
      updatedProduct = await addVariationToReadyMadeClothes(product, variation);
    }
    if (!updatedProduct) {
      return res.status(400).send({ error: "product not found" });
    }
    if (updatedProduct.error) {
      return res.status(400).send({ error: updatedProduct.error });
    }
    return res.status(200).send({ data: updatedProduct, message: "product updated successfully" });
  }
  catch (err) {
    return res.status(500).send({ error: err.message });
  }
}
const editProductVariation = async (req, res) => {
  try {
    const { productId, variation } = req.body;
    if (!productId) {
      return res.status(400).send({ error: "productId is required" });
    }
    if (!variation) {
      return res.status(400).send({ error: "variation is required" });
    }
    const product = await getProductByProductId(productId);
    if (!product) {
      return res.status(400).send({ error: "product not found" });
    }
    const user = await getAuthUser(req);
    if(user.shopId !== product.shopId && !user?.isAdmin && !user?.isSuperAdmin){
      return res.status(400).send({ error: "You are not authorized to edit this product" });
    }
    const productType = product.productType;
    let updatedProduct;
    if (productType === "readyMadeCloth") {
      updatedProduct = await addVariationToReadyMadeClothes(product, variation);
    }
    if (!updatedProduct) {
      return res.status(400).send({ error: "product not found" });
    }
    if (updatedProduct.error) {
      return res.status(400).send({ error: updatedProduct.error });
    }
    return res.status(200).send({ data: updatedProduct, message: "product updated successfully" });
  }
  catch (err) {
    return res.status(500).send({ error: err.message });
  }
}
const deleteProductVariation = async (req, res) => {
  try {
    const { productId,sku } = req.body;
    if (!productId) {
      return res.status(400).send({ error: "productId is required" });
    }
    if (!sku) {
      return res.status(400).send({ error: "sku is required" });
    }
    const product = await getProductByProductId(productId);
    if (!product) {
      return res.status(400).send({ error: "product not found" });
    }
    const user = await getAuthUser(req);
    if(user.shopId !== product.shopId && !user?.isAdmin && !user?.isSuperAdmin){
      return res.status(400).send({ error: "You are not authorized to edit this product" });
    }
    const productType = product.productType;
    const variations = product.variations;
    const variationExist = variations.find((v) => v.sku === sku);
    if (!variationExist) {
      return res.status(400).send({ error: "variation not found" });
    }
    updatedVariations = variations.filter((v) => v.sku !== sku);

    let updatedProduct;
    if (productType === "readyMadeCloth") {
      updatedProduct = await ReadyMadeClothes.findOneAndUpdate
        ({ productId }, { variations: updatedVariations }, { new: true }).exec();
    }
    if (!updatedProduct) {
      return res.status(400).send({ error: "product not found" });
    }
    return res.status(200).send({ data: updatedProduct, message: "product updated successfully" });
  }
  catch (err) {
    return res.status(500).send({ error: err.message });
  }
}

module.exports = {
  editProduct,
  deleteProducts,
  restoreProducts,
  createProduct,
  getProduct,
  getShopProducts,
  getCategoryProducts,
  getProducts,
  getShopDraftProducts,
  setProductStatus,
  getProductOptions,
  getProductById,
  addProductColorAndImages,
  deleteProductColor,
  deleteProductImage,
  setProductImageAsDefault,
  addImagesToProductColor,
  addProductVariation,
  editProductVariation,
  deleteProductVariation,
  submitProduct


};
