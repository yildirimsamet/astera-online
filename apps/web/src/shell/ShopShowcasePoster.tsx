import { cosmeticCard } from '../ui/cosmeticCopy.js';
import { PLANET_SKIN_CATALOG } from '../ui/skinCatalog.js';

/** Also keeps the shop entrance visible while models load or WebGL is unavailable. */
export function ShopShowcasePoster() {
  return <div className="shop-showcase-poster absolute inset-0" data-showcase-poster>
    <span className="shop-showcase-poster-ring" />
    <img src={PLANET_SKIN_CATALOG['planet-lava'].image} alt="" width={80} height={80} className="shop-showcase-poster-world" />
    <img src={cosmeticCard('ship-red-dragon')} alt="" width={100} height={68} className="shop-showcase-poster-dragon" />
    <img src="/assets/images/cosmetics/standards/flag-phoenix.svg" alt="" width={22} height={15} className="shop-showcase-poster-flag" />
    <img src={cosmeticCard('probe-ufo')} alt="" width={40} height={27} className="shop-showcase-poster-probe" />
  </div>;
}
