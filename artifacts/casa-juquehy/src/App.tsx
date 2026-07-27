import React from 'react';
import { Button } from '@/components/ui/button';
import { Gallery } from '@/components/Gallery';
import { ReservationSection } from '@/components/ReservationSection';
import { Reveal } from '@/components/Reveal';
import { HERO_IMAGE, GALLERY_IMAGES } from '@/lib/images';
import { 
  Wifi, Waves, Wind, Car, MapPin, 
  Coffee, Sun, Trees, ArrowRight, Instagram 
} from 'lucide-react';
import { useInView } from '@/hooks/use-in-view';
import { cn } from '@/lib/utils';

// Helper component for images with reveal
function RevealImage({ src, alt, className }: { src: string, alt: string, className?: string }) {
  const { ref, isInView } = useInView({ threshold: 0.2 });
  
  return (
    <div 
      ref={ref} 
      className={cn("image-reveal-wrapper rounded-2xl overflow-hidden", className, isInView && "in-view")}
    >
      <img src={src} alt={alt} className="w-full h-full object-cover image-reveal" />
    </div>
  );
}

export default function App() {
  const WHATSAPP_LINK = "https://wa.me/5511953553708";

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-primary/20 selection:text-foreground">
      
      {/* 1. HERO SECTION */}
      <section className="relative h-[90svh] w-full flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-black/30 z-10" />
          <img 
            src={HERO_IMAGE} 
            alt="Casa Juquehy vista frontal" 
            className="w-full h-full object-cover animate-in fade-in zoom-in-105 duration-2000"
          />
        </div>
        
        <div className="relative z-20 text-center px-4 max-w-4xl mx-auto flex flex-col items-center">
          <Reveal animation="fade-up" delay={200}>
            <span className="text-white/90 uppercase tracking-[0.2em] text-sm font-semibold mb-4 block drop-shadow-md">
              Litoral Norte, São Paulo
            </span>
          </Reveal>
          
          <Reveal animation="fade-up" delay={400}>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-serif text-white mb-6 drop-shadow-lg">
              Casa Juquehy
            </h1>
          </Reveal>
          
          <Reveal animation="fade-up" delay={600}>
            <p className="text-lg md:text-xl text-white/90 font-light max-w-2xl mx-auto mb-10 drop-shadow-md">
              O seu refúgio de tranquilidade, onde a brisa do mar encontra o conforto de um lar desenhado para memórias inesquecíveis.
            </p>
          </Reveal>
          
          <Reveal animation="scale-up" delay={800}>
            <Button 
              size="lg" 
              className="bg-primary text-primary-foreground hover:bg-primary/90 text-lg px-8 py-6 rounded-full shadow-xl transition-transform hover:scale-105"
              asChild
            >
              <a href="#reservas">
                Ver Disponibilidade
              </a>
            </Button>
          </Reveal>
        </div>
      </section>

      {/* 2. INTRO SECTION */}
      <section className="py-24 md:py-32 px-6 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 lg:gap-20 items-center">
          <RevealImage 
            src={GALLERY_IMAGES[1]} 
            alt="Interior da casa" 
            className="aspect-[4/5] shadow-2xl" 
          />
          
          <div className="space-y-8">
            <Reveal animation="fade-up">
              <h2 className="text-3xl md:text-5xl text-foreground font-serif leading-tight">
                Design rústico, alma caiçara.
              </h2>
            </Reveal>
            
            <Reveal animation="fade-up" delay={200}>
              <p className="text-lg text-muted-foreground font-light leading-relaxed">
                A poucos passos do mar, a Casa Juquehy foi pensada para ser uma extensão da natureza ao redor. Madeiras nobres, texturas naturais e espaços amplos que convidam a luz do sol a entrar.
              </p>
            </Reveal>
            
            <Reveal animation="fade-up" delay={300}>
              <p className="text-lg text-muted-foreground font-light leading-relaxed">
                Cada canto foi desenhado para acolher. Seja para um café da manhã demorado, um mergulho de tarde ou um jantar sob as estrelas. Aqui, o tempo passa diferente.
              </p>
            </Reveal>

            <Reveal animation="fade-up" delay={400}>
              <div className="grid grid-cols-2 gap-6 pt-4">
                <div className="space-y-2">
                  <span className="text-4xl font-serif text-primary block">4</span>
                  <span className="text-sm font-semibold tracking-wider uppercase text-muted-foreground">Suítes</span>
                </div>
                <div className="space-y-2">
                  <span className="text-4xl font-serif text-primary block">10</span>
                  <span className="text-sm font-semibold tracking-wider uppercase text-muted-foreground">Hóspedes</span>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 3. AMENITIES SECTION */}
      <section className="bg-white py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-6">
          <Reveal animation="fade-up">
            <div className="text-center mb-16">
              <span className="text-secondary font-semibold tracking-widest uppercase text-sm mb-3 block">Estrutura</span>
              <h2 className="text-3xl md:text-5xl font-serif">Tudo para seu conforto</h2>
            </div>
          </Reveal>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8">
            {[
              { icon: Waves, label: "Piscina Privativa" },
              { icon: Wind, label: "Ar Condicionado" },
              { icon: Wifi, label: "Wi-Fi Veloz" },
              { icon: Coffee, label: "Área Gourmet" },
              { icon: Car, label: "Vaga para 4 carros" },
              { icon: Trees, label: "Jardim Amplo" },
            ].map((amenity, idx) => (
              <Reveal key={idx} animation="fade-up" delay={idx * 100}>
                <div className="flex flex-col items-center text-center space-y-4 p-6 rounded-2xl bg-background border hover:border-primary/30 transition-colors">
                  <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
                    <amenity.icon size={24} strokeWidth={1.5} />
                  </div>
                  <span className="font-medium text-sm">{amenity.label}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 4. SPACES SHOWCASE */}
      <section className="py-24 md:py-32 px-6 max-w-7xl mx-auto">
        <div className="space-y-24">
          
          <div className="grid md:grid-cols-12 gap-8 md:gap-16 items-center">
            <div className="md:col-span-5 space-y-6 order-2 md:order-1">
              <Reveal animation="fade-up">
                <h3 className="text-2xl md:text-4xl font-serif">Área Social Integrada</h3>
              </Reveal>
              <Reveal animation="fade-up" delay={200}>
                <p className="text-muted-foreground font-light text-lg">
                  Salas de estar, jantar e cozinha conectadas à varanda. Uma planta livre que estimula a convivência e garante ventilação cruzada durante todo o dia.
                </p>
              </Reveal>
            </div>
            <div className="md:col-span-7 order-1 md:order-2">
              <RevealImage src={GALLERY_IMAGES[2]} alt="Área social" className="aspect-[16/10] shadow-xl" />
            </div>
          </div>

          <div className="grid md:grid-cols-12 gap-8 md:gap-16 items-center">
            <div className="md:col-span-7">
              <RevealImage src={GALLERY_IMAGES[3]} alt="Suíte" className="aspect-[16/10] shadow-xl" />
            </div>
            <div className="md:col-span-5 space-y-6">
              <Reveal animation="fade-up">
                <h3 className="text-2xl md:text-4xl font-serif">Suítes Aconchegantes</h3>
              </Reveal>
              <Reveal animation="fade-up" delay={200}>
                <p className="text-muted-foreground font-light text-lg">
                  Quartos projetados para o descanso pleno. Camas espaçosas, enxoval de alta qualidade e janelas amplas para acordar com o som dos pássaros.
                </p>
              </Reveal>
            </div>
          </div>

          <div className="grid md:grid-cols-12 gap-8 md:gap-16 items-center">
            <div className="md:col-span-5 space-y-6 order-2 md:order-1">
              <Reveal animation="fade-up">
                <h3 className="text-2xl md:text-4xl font-serif">Jardim e Lazer</h3>
              </Reveal>
              <Reveal animation="fade-up" delay={200}>
                <p className="text-muted-foreground font-light text-lg">
                  O coração externo da casa. Gramado impecável, piscina para se refrescar após a praia e espaço gourmet com churrasqueira para celebrar os melhores dias.
                </p>
              </Reveal>
            </div>
            <div className="md:col-span-7 order-1 md:order-2">
              <RevealImage src={GALLERY_IMAGES[4]} alt="Área de lazer" className="aspect-[16/10] shadow-xl" />
            </div>
          </div>

        </div>
      </section>

      {/* 5. FULL GALLERY */}
      <section className="bg-white py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
            <Reveal animation="fade-up">
              <span className="text-secondary font-semibold tracking-widest uppercase text-sm mb-3 block">Olhar</span>
              <h2 className="text-3xl md:text-5xl font-serif">Galeria Completa</h2>
            </Reveal>
            <Reveal animation="fade-in" delay={300}>
              <p className="text-muted-foreground font-light max-w-sm">
                Explore cada detalhe e sinta a atmosfera do nosso refúgio.
              </p>
            </Reveal>
          </div>
          
          <Reveal animation="fade-up" delay={200}>
            <Gallery />
          </Reveal>
        </div>
      </section>

      {/* 6. RESERVATION */}
      <ReservationSection />

      {/* 7. LOCATION */}
      <section className="py-24 md:py-32 px-6 relative overflow-hidden bg-accent/20">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-8 z-10">
            <Reveal animation="fade-up">
              <MapPin className="text-primary w-12 h-12 mb-6" strokeWidth={1} />
              <h2 className="text-3xl md:text-5xl font-serif text-foreground">
                A joia de São Sebastião
              </h2>
            </Reveal>
            
            <Reveal animation="fade-up" delay={200}>
              <p className="text-lg text-muted-foreground font-light leading-relaxed">
                Juquehy é conhecida como a "joia do Litoral Norte". Com areia fina, mar cristalino de águas calmas e cercada pela exuberância da Mata Atlântica, é o cenário perfeito para famílias e casais.
              </p>
            </Reveal>
            
            <Reveal animation="fade-up" delay={300}>
              <p className="text-lg text-muted-foreground font-light leading-relaxed">
                A casa está localizada em rua tranquila, garantindo silêncio e segurança, mas a uma curta caminhada tanto da praia quanto do centrinho gastronômico e charmosos shoppings de verão.
              </p>
            </Reveal>

            <Reveal animation="fade-up" delay={400}>
              <Button variant="outline" className="rounded-full mt-4" asChild>
                <a href="https://maps.google.com" target="_blank" rel="noopener noreferrer">
                  Ver no Mapa <ArrowRight className="ml-2 w-4 h-4" />
                </a>
              </Button>
            </Reveal>
          </div>
          
          <div className="relative z-10 h-full flex items-center">
            <RevealImage 
              src={GALLERY_IMAGES[5]} 
              alt="Praia de Juquehy" 
              className="w-full aspect-square md:aspect-[4/3] rounded-3xl shadow-2xl" 
            />
          </div>
        </div>
      </section>

       {/* 8. CTA & FOOTER */}
      <section className="bg-foreground text-background py-32 px-6 text-center">
        <div className="max-w-3xl mx-auto space-y-10">
          <Reveal animation="fade-up">
            <Sun className="w-12 h-12 text-primary mx-auto opacity-80" strokeWidth={1} />
          </Reveal>
          
          <Reveal animation="fade-up" delay={100}>
            <h2 className="text-4xl md:text-6xl font-serif">Sua próxima viagem começa aqui.</h2>
          </Reveal>
          
          <Reveal animation="fade-up" delay={200}>
            <p className="text-xl text-white/60 font-light">
              Consulte nossas datas disponíveis e garanta seus dias de descanso.
            </p>
          </Reveal>
          
          <Reveal animation="scale-up" delay={400}>
            <Button 
              size="lg" 
              className="bg-primary text-primary-foreground hover:bg-primary/90 text-lg px-10 py-7 rounded-full shadow-2xl transition-transform hover:scale-105"
              asChild
            >
              <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer">
                Falar no WhatsApp
              </a>
            </Button>
          </Reveal>
        </div>
      </section>

      <footer className="bg-foreground text-white/40 py-12 px-6 border-t border-white/10 text-center">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <span className="font-serif text-2xl text-white/80">Casa Juquehy</span>
          
          <div className="text-sm font-light">
            © {new Date().getFullYear()} Casa Juquehy. Todos os direitos reservados.
          </div>
          
          <div className="flex gap-4">
            <a href="#" className="hover:text-white transition-colors">
              <Instagram className="w-5 h-5" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
