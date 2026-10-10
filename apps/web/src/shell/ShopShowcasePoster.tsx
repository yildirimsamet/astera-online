/** Lava with an Inferno ring, and the Red Dragon carrying a Phoenix clan standard. */
export function ShopShowcasePoster() {
  return <img
    src="/assets/images/cosmetics/shop-showcase-static.webp"
    alt=""
    width={512}
    height={512}
    loading="eager"
    decoding="async"
    fetchPriority="high"
    draggable={false}
    onError={event => { event.currentTarget.style.visibility = 'hidden'; }}
    onLoad={event => { event.currentTarget.style.visibility = 'visible'; }}
    className="shop-showcase-poster"
    data-showcase-poster
  />;
}
