import { Card, CardContent } from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

type Banner = {
  id: string;
  image_url: string;
  title: string | null;
};

interface HomeCarouselProps {
  banners: Banner[];
}

export default function HomeCarousel({ banners }: HomeCarouselProps) {
  if (!banners || banners.length === 0) {
    return null;
  }

  return (
    <div className="w-full">
      <Carousel className="w-full" opts={{ loop: true }}>
        <CarouselContent className="-ml-0">
          {banners.map((banner) => (
            <CarouselItem key={banner.id} className="pl-0">
              <div 
                className="w-full bg-cover bg-center aspect-banner" 
                style={{
                  backgroundImage: `url(${banner.image_url})`
                }}
                aria-label={banner.title || 'Banner Image'}
              />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="absolute left-4" />
        <CarouselNext className="absolute right-4" />
      </Carousel>
    </div>
  );
} 