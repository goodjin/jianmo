import { defineComponent, type ComponentOptions } from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';

/**
 * Creates a generic wrapper component to test Vue composables (hooks)
 * that use lifecycle methods like onMounted/onUnmounted.
 *
 * @param useComposable A function that calls the composable
 * @returns An object containing the mounted wrapper, cleanup function, and the result of the composable
 */
export function withSetup<T>(composableFn: () => T): {
  wrapper: VueWrapper;
  cleanup: () => void;
  result: T;
} {
  let result: T;

  const WrapperComponent = defineComponent({
    setup() {
      result = composableFn();
      // render nothing
      return () => {};
    },
  });

  const wrapper = mount(WrapperComponent);

  const cleanup = () => {
    wrapper.unmount();
  };

  return {
    wrapper,
    cleanup,
    // @ts-ignore - we know it's assigned synchronously during setup
    result,
  };
}
