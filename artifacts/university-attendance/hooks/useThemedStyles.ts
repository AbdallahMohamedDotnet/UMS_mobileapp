import { useColors } from '@/hooks/useColors';

type Colors = ReturnType<typeof useColors>;
type Factory<T> = (colors: Colors) => T;

/**
 * Per-palette stylesheet cache.
 *
 * `useMemo(() => createStyles(colors), [colors])` re-runs `StyleSheet.create`
 * for every *instance* of a component — which, for a list row, means once per
 * visible row and again on every recycle. The palette object from useColors()
 * is stable per color scheme, so we can key off it and build each stylesheet
 * exactly once for the life of the app.
 */
const cache = new WeakMap<Colors, WeakMap<Factory<unknown>, unknown>>();

export function useThemedStyles<T>(factory: Factory<T>): T {
  const colors = useColors();
  let byFactory = cache.get(colors);
  if (!byFactory) {
    byFactory = new WeakMap();
    cache.set(colors, byFactory);
  }
  let styles = byFactory.get(factory as Factory<unknown>) as T | undefined;
  if (!styles) {
    styles = factory(colors);
    byFactory.set(factory as Factory<unknown>, styles);
  }
  return styles;
}
