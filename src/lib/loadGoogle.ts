export function loadGoogleMaps(key: string) {
  return new Promise<any>((resolve, reject) => {
    if ((window as any).google?.maps) return resolve((window as any).google.maps);
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`;
    s.async = true;
    s.onload = () => resolve((window as any).google.maps);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}