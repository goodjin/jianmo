import { defineComponent, type ComponentOptions } from 'vue';
import { mount } from '@vue/test-utils';

/**
 * Creates a generic wrapper component to test Vue composables (hooks)
 * that use lifecycle methods like onMounted/onUnmounted.
 *
 * @param useComposable A function that calls the composable
 * @returns An object containing the mounted wrapper and the result of the composable
 */
export function withSetup<T>(composableFn: () => T) {
  let result: T;

  const WrapperComponent = defineComponent({
    setup() {
      result = composableFn();
      // render nothing
      return () => {};
    },
  });

  const wrapper = mount(WrapperComponent);

  return {
    wrapper,
    // @ts-ignore - we know it's assigned synchronously during setup
    result,
  };
}
