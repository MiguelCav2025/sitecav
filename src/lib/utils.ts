import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getYouTubeThumbnail(url: string | null): string | null {
  if (!url) return null;

  try {
    const urlObj = new URL(url);
    let videoId = null;

    if (urlObj.hostname === 'youtu.be') {
      videoId = urlObj.pathname.slice(1);
    } else if (urlObj.hostname === 'www.youtube.com' || urlObj.hostname === 'youtube.com') {
      videoId = urlObj.searchParams.get('v');
    }

    if (videoId) {
      return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    }

    return null;
  } catch (_) {
    return null;
  }
}

export function getYouTubeEmbedUrl(url: string): string | null {
  if (!url) return null;

  let videoId;
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname === "youtu.be") {
      videoId = urlObj.pathname.slice(1);
    } else {
      videoId = urlObj.searchParams.get("v");
    }
  } catch (_) {
    // Se a URL for inválida, pode ser apenas o ID
    if (url.length === 11) {
      videoId = url;
    } else {
      console.error("Invalid YouTube URL:", url);
      return null;
    }
  }
  
  if (!videoId) return null;
  
  return `https://www.youtube.com/embed/${videoId}?autoplay=1`;
}
