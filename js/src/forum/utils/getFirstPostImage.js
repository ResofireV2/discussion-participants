/**
 * Extract the first image URL from a post's contentHtml string.
 * Parses once and caches the result on the discussion object.
 * Returns null if no image is found.
 */
export default function getFirstPostImage(discussion) {
  if (!('_cardImageCache' in discussion)) {
    discussion._cardImageCache = null;
    try {
      const firstPost = discussion.firstPost();
      if (firstPost) {
        const html = firstPost.contentHtml() || '';
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const img = doc.querySelector('img');
        discussion._cardImageCache = (img && img.src) ? img.src : null;
      }
    } catch (e) {}
  }
  return discussion._cardImageCache;
}
