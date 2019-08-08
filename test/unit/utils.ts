import { ServiceWorkerState, IPage } from './../../src';
import { MappedEvent, EventMapping } from 'chrome-debugging-client';

type Scenario = (state: ServiceWorkerState, page: TestPage) => Promise<void>;

class TestPage implements IPage {
  listeners: {
    [key: string]: Function[]
  } = {};
  send() {
    return null as any;
  }
  on<E extends MappedEvent>(
    event: E,
    listener: (event: EventMapping[E]) => void,
  ) {
    this.listeners[event] = this.listeners[event] || [];
    this.listeners[event].push(listener);
  }
  trigger<E extends MappedEvent>(
    event: E,
    eventParam: EventMapping[E]
  ) {
    const listeners = this.listeners[event];
    for (let i = 0; i < listeners.length; i++) {
      listeners[i](eventParam);
    }
  }
  until() {
    return null as any;
  }
}

export async function runMockScenario(cb: Scenario) {
  const page = new TestPage();
  const state = new ServiceWorkerState(page);
  await cb(state, page);
}