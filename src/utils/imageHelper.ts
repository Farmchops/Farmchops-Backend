import cloudinary from '../config/cloudinary';

export const deleteImage = async (imageUrl: string): Promise<void> => {
  try {
    // Extract public_id from cloudinary URL
    const publicId = extractPublicId(imageUrl);
    if (publicId) {
      await cloudinary.uploader.destroy(publicId);
    }
  } catch (error) {
    console.error('Error deleting image:', error);
  }
};

export const deleteMultipleImages = async (imageUrls: string[]): Promise<void> => {
  try {
    const publicIds = imageUrls
      .map(url => extractPublicId(url))
      .filter(id => id !== null) as string[];
    
    if (publicIds.length > 0) {
      await cloudinary.api.delete_resources(publicIds);
    }
  } catch (error) {
    console.error('Error deleting multiple images:', error);
  }
};

const extractPublicId = (imageUrl: string): string | null => {
  try {
    // Cloudinary URL format: https://res.cloudinary.com/{cloud_name}/image/upload/{transformations}/{public_id}.{format}
    const matches = imageUrl.match(/\/v\d+\/(.+)\.(jpg|jpeg|png)$/i);
    return matches && matches[1] ? matches[1] : null;
  } catch (error) {
    return null;
  }
};