export function loadGoogleMaps(key: string) {
  return new Promise<any>((resolve, reject) => {
    if ((window as any).google?.maps) {
      return resolve((window as any).google.maps);
    }
    
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`;
    s.async = true;
    s.onload = () => {
      // Wait a bit for Google Maps to fully initialize
      setTimeout(() => {
        if ((window as any).google?.maps) {
          resolve((window as any).google.maps);
        } else {
          reject(new Error('Google Maps failed to initialize'));
        }
      }, 100);
    };
    s.onerror = (error) => {
      console.error('Failed to load Google Maps script:', error);
      reject(new Error('Failed to load Google Maps script'));
    };
    document.head.appendChild(s);
  });
}