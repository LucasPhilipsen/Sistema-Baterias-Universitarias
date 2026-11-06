import LogoLoop from './LogoLoop/LogoLoop.jsx';
import styles from './BateriaLogos.module.css';

const bateriaLogos = [
  { src: '/logos/infanteria.png', alt: 'Bateria Infanteria — UFABC', title: 'Infanteria', width: 463, height: 463 },
  { src: '/logos/meritissima.png', alt: 'Bateria Meritíssima — Direito UFU', title: 'Meritíssima', width: 463, height: 463 },
  { src: '/logos/rateria.png', alt: 'Rateria — Poli-USP', title: 'Rateria', width: 166, height: 192 },
  { src: '/logos/sa.png', alt: 'Bateria S/A', title: 'Bateria S/A', width: 463, height: 463 },
  { src: '/logos/bandida.png', alt: 'Bateria Bandida — EACH-USP', title: 'Bandida', width: 429, height: 429 },
  { src: '/logos/espm.png', alt: 'Bateria ESPM', title: 'Bateria ESPM', width: 251, height: 251 },
  { src: '/logos/computaria.png', alt: 'Bateria Computaria — UFU', title: 'Computaria', width: 425, height: 426 },
];

// O ciclo precisa dos tamanhos de todos os emblemas, inclusive fora da tela.
const renderLogo = logo => <img src={logo.src} alt={logo.alt} title={logo.title}
  width={logo.width} height={logo.height} loading="eager" decoding="async" draggable={false} />;

export default function BateriaLogos({ logos = bateriaLogos, speed = 45, logoHeight = 80, gap = 128, className = '' }) {
  return <div className={`${styles.rail} ${className}`}>
    <LogoLoop
      className={styles.loop}
      logos={logos}
      renderItem={renderLogo}
      speed={speed}
      direction="left"
      logoHeight={logoHeight}
      gap={gap}
      hoverSpeed={0}
      hoverTarget="item"
      scaleOnHover
      fadeOut
      fadeOutWidth={0.05}
      intro={false}
      ariaLabel="Logos de baterias universitárias"
    />
  </div>;
}
