// Responsive Image Helper for Stellar LABS Platform
// Provides utilities for optimized image delivery with WebP support
import { useState, useEffect } from 'react';

export const getResponsiveImage = (imageName, size = 'medium', format = 'webp') => {
  return `/images/optimized/${size}/${imageName.split('.')[0]}.${format}`;
};

export const getPictureElement = (imageName, alt, className = '') => {
  const baseName = imageName.split('.')[0];
  
  return (
    <picture className={className}>
      <source
        srcSet={getResponsiveImage(baseName, 'small', 'webp')}
        media="(max-width: 320px)"
        type="image/webp"
      />
      <source
        srcSet={getResponsiveImage(baseName, 'medium', 'webp')}
        media="(max-width: 768px)"
        type="image/webp"
      />
      <source
        srcSet={getResponsiveImage(baseName, 'large', 'webp')}
        media="(max-width: 1024px)"
        type="image/webp"
      />
      <source
        srcSet={getResponsiveImage(baseName, 'xlarge', 'webp')}
        media="(min-width: 1025px)"
        type="image/webp"
      />
      {/* Fallback for browsers that don't support WebP */}
      <source
        srcSet={getResponsiveImage(baseName, 'small', 'jpeg')}
        media="(max-width: 320px)"
        type="image/jpeg"
      />
      <source
        srcSet={getResponsiveImage(baseName, 'medium', 'jpeg')}
        media="(max-width: 768px)"
        type="image/jpeg"
      />
      <source
        srcSet={getResponsiveImage(baseName, 'large', 'jpeg')}
        media="(max-width: 1024px)"
        type="image/jpeg"
      />
      <source
        srcSet={getResponsiveImage(baseName, 'xlarge', 'jpeg')}
        media="(min-width: 1025px)"
        type="image/jpeg"
      />
      <img
        src={getResponsiveImage(baseName, 'medium', 'jpeg')}
        alt={alt}
        loading="lazy"
        className={className}
      />
    </picture>
  );
};

// Hook for lazy loading images with intersection observer
export const useLazyImage = (src, placeholder = null) => {
  const [imageSrc, setImageSrc] = useState(placeholder);
  const [imageRef, setImageRef] = useState();

  useEffect(() => {
    let observer;
    let LABSCancel = false;

    if (imageRef && imageSrc !== src) {
      if (IntersectionObserver) {
        observer = new IntersectionObserver(
          entries => {
            entries.forEach(entry => {
              if (entry.isIntersecting && !LABSCancel) {
                setImageSrc(src);
                observer.unobserve(imageRef);
              }
            });
          },
          { threshold: 0.1 }
        );
        observer.observe(imageRef);
      } else {
        // Fallback for browsers that don't support IntersectionObserver
        setImageSrc(src);
      }
    }

    return () => {
      LABSCancel = true;
      if (observer && observer.unobserve) {
        observer.unobserve(imageRef);
      }
    };
  }, [src, imageSrc, imageRef]);

  return [imageRef, imageSrc, setImageSrc];
};

// Optimized Image Component
export const OptimizedImage = ({ 
  imageName, 
  alt, 
  className = '', 
  size = 'medium',
  lazy = true,
  placeholder = null 
}) => {
  const [imageRef, imageSrc] = useLazyImage(
    getResponsiveImage(imageName, size, 'webp'),
    placeholder
  );

  if (lazy) {
    return (
      <img
        ref={imageRef}
        src={imageSrc}
        alt={alt}
        className={className}
        loading="lazy"
      />
    );
  }

  return getPictureElement(imageName, alt, className);
};

// Utility to check WebP support
export const checkWebPSupport = () => {
  return new Promise((resolve) => {
    const webP = new Image();
    webP.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
    webP.onload = webP.onerror = function () {
      resolve(webP.height === 2);
    };
  });
};

// Preload critical images
export const preloadImage = (src) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = src;
    img.onload = resolve;
    img.onerror = reject;
  });
};

// Batch preload multiple images
export const preloadImages = async (imageUrls) => {
  try {
    await Promise.all(imageUrls.map(url => preloadImage(url)));
    console.log('All images preloaded successfully');
  } catch (error) {
    console.error('Error preloading images:', error);
  }
};
