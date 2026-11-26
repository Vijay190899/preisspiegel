/**
 * The opening: the Preisspiegel mark rising and finding its reflection, once
 * per visit, before the overview's lights come on.
 *
 * Whether it plays is decided before the first paint, by a script in the
 * page head, so the overlay is in the server-rendered page and needs no
 * script of its own: CSS plays it and lifts it. It does not play a second
 * time in a visit, without scripts, or for a reader who asked for reduced
 * motion (the CSS hides it).
 */
export const INTRO_KEY = 'preisspiegel:intro'

/** How long the opening holds the page, in milliseconds (the CSS agrees). */
export const INTRO_MS = 1500

export const introBootScript = `(function(){var d=document.documentElement;try{if(sessionStorage.getItem('${INTRO_KEY}')){d.dataset.intro='seen'}else{sessionStorage.setItem('${INTRO_KEY}','1');d.dataset.intro='play'}}catch(e){d.dataset.intro='seen'}})()`

/**
 * Whether the opening is playing on this load, read in the browser. What
 * waits for it (the words arriving, the figures counting) starts after it.
 */
export function introPlaying(): boolean {
  if (typeof document === 'undefined') return false
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return false
  }
  return document.documentElement.dataset.intro === 'play'
}
