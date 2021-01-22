var app = (function () {
    'use strict';

    function noop() { }
    const identity = x => x;
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    function run_tasks(now) {
        tasks.forEach(task => {
            if (!task.c(now)) {
                tasks.delete(task);
                task.f();
            }
        });
        if (tasks.size !== 0)
            raf(run_tasks);
    }
    /**
     * Creates a new task that runs on each raf frame
     * until it returns a falsy value or is aborted
     */
    function loop(callback) {
        let task;
        if (tasks.size === 0)
            raf(run_tasks);
        return {
            promise: new Promise(fulfill => {
                tasks.add(task = { c: callback, f: fulfill });
            }),
            abort() {
                tasks.delete(task);
            }
        };
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function to_number(value) {
        return value === '' ? null : +value;
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.wholeText !== data)
            text.data = data;
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    /* src/HowTo.svelte generated by Svelte v3.29.4 */

    function create_fragment(ctx) {
    	let div;

    	return {
    		c() {
    			div = element("div");
    			div.innerHTML = `<img bp="offset-5@md 4@md 12@sm" src="handwashing.gif" alt="How to wash your hands." class="svelte-1b0pxt1"/>`;
    			attr(div, "bp", "grid");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    class HowTo extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, null, create_fragment, safe_not_equal, {});
    	}
    }

    /* src/ProgressBar.svelte generated by Svelte v3.29.4 */

    function create_fragment$1(ctx) {
    	let div2;
    	let div1;
    	let div0;
    	let span;
    	let t0;
    	let t1;

    	return {
    		c() {
    			div2 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			span = element("span");
    			t0 = text("%");
    			t1 = text(/*progress*/ ctx[0]);
    			attr(span, "class", "sr-only");
    			attr(div0, "class", "progress-bar svelte-yf0v46");
    			set_style(div0, "width", /*progress*/ ctx[0] + "%");
    			attr(div1, "class", "progress-container svelte-yf0v46");
    			attr(div1, "bp", "offset-5@md 4@md 12@sm");
    			attr(div2, "bp", "grid");
    		},
    		m(target, anchor) {
    			insert(target, div2, anchor);
    			append(div2, div1);
    			append(div1, div0);
    			append(div0, span);
    			append(span, t0);
    			append(span, t1);
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*progress*/ 1) set_data(t1, /*progress*/ ctx[0]);

    			if (dirty & /*progress*/ 1) {
    				set_style(div0, "width", /*progress*/ ctx[0] + "%");
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div2);
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let { progress = 0 } = $$props;

    	$$self.$$set = $$props => {
    		if ("progress" in $$props) $$invalidate(0, progress = $$props.progress);
    	};

    	return [progress];
    }

    class ProgressBar extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance, create_fragment$1, safe_not_equal, { progress: 0 });
    	}
    }

    /* src/Timer.svelte generated by Svelte v3.29.4 */

    function create_fragment$2(ctx) {
    	let div0;
    	let h2;
    	let t0;
    	let t1;
    	let t2;
    	let progressbar;
    	let t3;
    	let div1;
    	let button;
    	let t4;
    	let current;
    	let mounted;
    	let dispose;
    	progressbar = new ProgressBar({ props: { progress: /*progress*/ ctx[2] } });

    	return {
    		c() {
    			div0 = element("div");
    			h2 = element("h2");
    			t0 = text("Seconds Left: ");
    			t1 = text(/*secondsLeft*/ ctx[0]);
    			t2 = space();
    			create_component(progressbar.$$.fragment);
    			t3 = space();
    			div1 = element("div");
    			button = element("button");
    			t4 = text("Start");
    			attr(h2, "bp", "offset-5@md 4@md 12@sm");
    			attr(h2, "class", "svelte-13cug7o");
    			attr(div0, "bp", "grid");
    			button.disabled = /*isRunning*/ ctx[1];
    			attr(button, "bp", "offset-5@md 4@md 12@sm");
    			attr(button, "class", "start svelte-13cug7o");
    			attr(div1, "bp", "grid");
    		},
    		m(target, anchor) {
    			insert(target, div0, anchor);
    			append(div0, h2);
    			append(h2, t0);
    			append(h2, t1);
    			insert(target, t2, anchor);
    			mount_component(progressbar, target, anchor);
    			insert(target, t3, anchor);
    			insert(target, div1, anchor);
    			append(div1, button);
    			append(button, t4);
    			current = true;

    			if (!mounted) {
    				dispose = listen(button, "click", /*startTimer*/ ctx[3]);
    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (!current || dirty & /*secondsLeft*/ 1) set_data(t1, /*secondsLeft*/ ctx[0]);
    			const progressbar_changes = {};
    			if (dirty & /*progress*/ 4) progressbar_changes.progress = /*progress*/ ctx[2];
    			progressbar.$set(progressbar_changes);

    			if (!current || dirty & /*isRunning*/ 2) {
    				button.disabled = /*isRunning*/ ctx[1];
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(progressbar.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(progressbar.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div0);
    			if (detaching) detach(t2);
    			destroy_component(progressbar, detaching);
    			if (detaching) detach(t3);
    			if (detaching) detach(div1);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    const totalSeconds = 3;

    function instance$1($$self, $$props, $$invalidate) {
    	let secondsLeft = totalSeconds;
    	let isRunning = false;
    	const dispatch = createEventDispatcher();

    	/* funcs */
    	function startTimer() {
    		$$invalidate(1, isRunning = true);

    		const timer = setInterval(
    			() => {
    				$$invalidate(0, secondsLeft -= 1);

    				if (secondsLeft == 0) {
    					clearInterval(timer);
    					$$invalidate(1, isRunning = false);
    					$$invalidate(0, secondsLeft = totalSeconds);
    					dispatch("end");
    					console.log("Timer1 Complete");
    				}
    			},
    			1000
    		);
    	}

    	let progress;

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*secondsLeft*/ 1) {
    			 $$invalidate(2, progress = (totalSeconds - secondsLeft) / totalSeconds * 100);
    		}
    	};

    	return [secondsLeft, isRunning, progress, startTimer];
    }

    class Timer extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$1, create_fragment$2, safe_not_equal, {});
    	}
    }

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = [];
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (let i = 0; i < subscribers.length; i += 1) {
                        const s = subscribers[i];
                        s[1]();
                        subscriber_queue.push(s, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.push(subscriber);
            if (subscribers.length === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                const index = subscribers.indexOf(subscriber);
                if (index !== -1) {
                    subscribers.splice(index, 1);
                }
                if (subscribers.length === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    function cubicOut(t) {
        const f = t - 1.0;
        return f * f * f + 1.0;
    }

    function is_date(obj) {
        return Object.prototype.toString.call(obj) === '[object Date]';
    }

    function get_interpolator(a, b) {
        if (a === b || a !== a)
            return () => a;
        const type = typeof a;
        if (type !== typeof b || Array.isArray(a) !== Array.isArray(b)) {
            throw new Error('Cannot interpolate values of different type');
        }
        if (Array.isArray(a)) {
            const arr = b.map((bi, i) => {
                return get_interpolator(a[i], bi);
            });
            return t => arr.map(fn => fn(t));
        }
        if (type === 'object') {
            if (!a || !b)
                throw new Error('Object cannot be null');
            if (is_date(a) && is_date(b)) {
                a = a.getTime();
                b = b.getTime();
                const delta = b - a;
                return t => new Date(a + t * delta);
            }
            const keys = Object.keys(b);
            const interpolators = {};
            keys.forEach(key => {
                interpolators[key] = get_interpolator(a[key], b[key]);
            });
            return t => {
                const result = {};
                keys.forEach(key => {
                    result[key] = interpolators[key](t);
                });
                return result;
            };
        }
        if (type === 'number') {
            const delta = b - a;
            return t => a + t * delta;
        }
        throw new Error(`Cannot interpolate ${type} values`);
    }
    function tweened(value, defaults = {}) {
        const store = writable(value);
        let task;
        let target_value = value;
        function set(new_value, opts) {
            if (value == null) {
                store.set(value = new_value);
                return Promise.resolve();
            }
            target_value = new_value;
            let previous_task = task;
            let started = false;
            let { delay = 0, duration = 400, easing = identity, interpolate = get_interpolator } = assign(assign({}, defaults), opts);
            if (duration === 0) {
                if (previous_task) {
                    previous_task.abort();
                    previous_task = null;
                }
                store.set(value = target_value);
                return Promise.resolve();
            }
            const start = now() + delay;
            let fn;
            task = loop(now => {
                if (now < start)
                    return true;
                if (!started) {
                    fn = interpolate(value, new_value);
                    if (typeof duration === 'function')
                        duration = duration(value, new_value);
                    started = true;
                }
                if (previous_task) {
                    previous_task.abort();
                    previous_task = null;
                }
                const elapsed = now - start;
                if (elapsed > duration) {
                    store.set(value = new_value);
                    return false;
                }
                // @ts-ignore
                store.set(value = fn(easing(elapsed / duration)));
                return true;
            });
            return task.promise;
        }
        return {
            set,
            update: (fn, opts) => set(fn(target_value, value), opts),
            subscribe: store.subscribe
        };
    }

    /* src/Timer2Tween.svelte generated by Svelte v3.29.4 */

    function create_else_block(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			button = element("button");
    			button.textContent = "⏸ Pause";
    			attr(button, "bp", "offset-5@md 4@md 12@sm");
    			attr(button, "class", "svelte-9co3ai");
    		},
    		m(target, anchor) {
    			insert(target, button, anchor);

    			if (!mounted) {
    				dispose = listen(button, "click", /*pause*/ ctx[7]);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(button);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    // (100:2) {#if !isRunning || paused}
    function create_if_block(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			button = element("button");
    			button.textContent = "⏱ Start";
    			attr(button, "bp", "offset-5@md 4@md 12@sm");
    			attr(button, "class", "svelte-9co3ai");
    		},
    		m(target, anchor) {
    			insert(target, button, anchor);

    			if (!mounted) {
    				dispose = listen(button, "click", /*start*/ ctx[5]);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(button);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function create_fragment$3(ctx) {
    	let div0;
    	let h2;
    	let t0;

    	let t1_value = (/*$progressStore*/ ctx[4] < 10
    	? `0${Math.floor(/*$progressStore*/ ctx[4])}`
    	: `${Math.floor(/*$progressStore*/ ctx[4])}`) + "";

    	let t1;
    	let t2;
    	let div2;
    	let div1;
    	let progress;
    	let t3;
    	let input;
    	let t4;
    	let div3;
    	let t5;
    	let button;
    	let mounted;
    	let dispose;

    	function select_block_type(ctx, dirty) {
    		if (!/*isRunning*/ ctx[0] || /*paused*/ ctx[1]) return create_if_block;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	return {
    		c() {
    			div0 = element("div");
    			h2 = element("h2");
    			t0 = text("Seconds Left:\n    ");
    			t1 = text(t1_value);
    			t2 = space();
    			div2 = element("div");
    			div1 = element("div");
    			progress = element("progress");
    			t3 = space();
    			input = element("input");
    			t4 = space();
    			div3 = element("div");
    			if_block.c();
    			t5 = space();
    			button = element("button");
    			button.textContent = "♻ Reset";
    			attr(h2, "bp", "offset-5@md 4@md 12@sm");
    			attr(div0, "bp", "grid");
    			progress.value = /*$progressStore*/ ctx[4];
    			attr(progress, "min", "0");
    			attr(progress, "max", /*seconds*/ ctx[2]);
    			attr(progress, "class", "svelte-9co3ai");
    			attr(input, "type", "range");
    			attr(input, "min", "1");
    			attr(input, "max", "60");
    			attr(input, "class", "svelte-9co3ai");
    			attr(div1, "class", "progress-container");
    			attr(div1, "bp", "offset-5@md 4@md 12@sm");
    			attr(div2, "bp", "grid");
    			attr(button, "bp", "offset-5@md 4@md 12@sm");
    			attr(button, "class", "svelte-9co3ai");
    			attr(div3, "bp", "grid");
    		},
    		m(target, anchor) {
    			insert(target, div0, anchor);
    			append(div0, h2);
    			append(h2, t0);
    			append(h2, t1);
    			insert(target, t2, anchor);
    			insert(target, div2, anchor);
    			append(div2, div1);
    			append(div1, progress);
    			append(div1, t3);
    			append(div1, input);
    			set_input_value(input, /*seconds*/ ctx[2]);
    			insert(target, t4, anchor);
    			insert(target, div3, anchor);
    			if_block.m(div3, null);
    			append(div3, t5);
    			append(div3, button);

    			if (!mounted) {
    				dispose = [
    					listen(input, "change", /*input_change_input_handler*/ ctx[8]),
    					listen(input, "input", /*input_change_input_handler*/ ctx[8]),
    					listen(input, "change", /*stop*/ ctx[6]),
    					listen(button, "click", /*stop*/ ctx[6])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*$progressStore*/ 16 && t1_value !== (t1_value = (/*$progressStore*/ ctx[4] < 10
    			? `0${Math.floor(/*$progressStore*/ ctx[4])}`
    			: `${Math.floor(/*$progressStore*/ ctx[4])}`) + "")) set_data(t1, t1_value);

    			if (dirty & /*$progressStore*/ 16) {
    				progress.value = /*$progressStore*/ ctx[4];
    			}

    			if (dirty & /*seconds*/ 4) {
    				attr(progress, "max", /*seconds*/ ctx[2]);
    			}

    			if (dirty & /*seconds*/ 4) {
    				set_input_value(input, /*seconds*/ ctx[2]);
    			}

    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div3, t5);
    				}
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div0);
    			if (detaching) detach(t2);
    			if (detaching) detach(div2);
    			if (detaching) detach(t4);
    			if (detaching) detach(div3);
    			if_block.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    let resetDuration = 400;

    function instance$2($$self, $$props, $$invalidate) {
    	let $progressStore,
    		$$unsubscribe_progressStore = noop,
    		$$subscribe_progressStore = () => ($$unsubscribe_progressStore(), $$unsubscribe_progressStore = subscribe(progressStore, $$value => $$invalidate(4, $progressStore = $$value)), progressStore);

    	$$self.$$.on_destroy.push(() => $$unsubscribe_progressStore());
    	const dispatch = createEventDispatcher();

    	// track whether the timer is in progress
    	let isRunning = false;

    	let paused = false;

    	// seconds for the timer
    	let seconds = 2;

    	// set progress to 0 (tweening for the period computed in the milliseconds variable).
    	async function start() {
    		$$invalidate(1, paused = false);
    		$$invalidate(0, isRunning = true);
    		await progressStore.set(0);

    		// then, when timer reaches 0
    		progressStore.set(seconds, {
    			duration: resetDuration,
    			easing: cubicOut
    		});

    		$$invalidate(0, isRunning = false);
    		console.log("Timer2 Complete");
    		dispatch("end");
    	}

    	function stop() {
    		$$invalidate(1, paused = false);
    		$$invalidate(0, isRunning = false);

    		progressStore.set(seconds, {
    			duration: resetDuration,
    			easing: cubicOut
    		});
    	}

    	function pause() {
    		if (paused) {
    			start();
    		} else {
    			$$invalidate(1, paused = true);

    			progressStore.set($progressStore, {
    				duration: resetDuration,
    				easing: cubicOut
    			});
    		}
    	}

    	function input_change_input_handler() {
    		seconds = to_number(this.value);
    		$$invalidate(2, seconds);
    	}

    	let milliseconds;
    	let progressStore;

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*seconds*/ 4) {
    			// We make this reactive($:) because when `seconds` changes, this needs to
    			// recompute.
    			 $$invalidate(9, milliseconds = seconds * 1000);
    		}

    		if ($$self.$$.dirty & /*seconds, milliseconds*/ 516) {
    			// Tying the duration to `milliseconds` and making the assignment reactive
    			// ($:) allows to change value
    			 $$subscribe_progressStore($$invalidate(3, progressStore = tweened(seconds, { duration: milliseconds })));
    		}
    	};

    	return [
    		isRunning,
    		paused,
    		seconds,
    		progressStore,
    		$progressStore,
    		start,
    		stop,
    		pause,
    		input_change_input_handler
    	];
    }

    class Timer2Tween extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$2, create_fragment$3, safe_not_equal, {});
    	}
    }

    /* src/App.svelte generated by Svelte v3.29.4 */

    function create_fragment$4(ctx) {
    	let h10;
    	let t1;
    	let timer2tween;
    	let t2;
    	let howto0;
    	let t3;
    	let h11;
    	let t5;
    	let timer;
    	let t6;
    	let howto1;
    	let t7;
    	let h3;
    	let t11;
    	let audio_1;
    	let current;
    	timer2tween = new Timer2Tween({});
    	timer2tween.$on("end", /*timerEnds*/ ctx[1]);
    	howto0 = new HowTo({});
    	timer = new Timer({});
    	timer.$on("end", /*timerEnds*/ ctx[1]);
    	howto1 = new HowTo({});

    	return {
    		c() {
    			h10 = element("h1");
    			h10.textContent = "Handwashing App (Store & Tweened Async Progress Bar Version)";
    			t1 = space();
    			create_component(timer2tween.$$.fragment);
    			t2 = space();
    			create_component(howto0.$$.fragment);
    			t3 = space();
    			h11 = element("h1");
    			h11.textContent = "Handwashing App (Original Tutorial Version)";
    			t5 = space();
    			create_component(timer.$$.fragment);
    			t6 = space();
    			create_component(howto1.$$.fragment);
    			t7 = space();
    			h3 = element("h3");

    			h3.innerHTML = `<a href="https://www.who.int/gpsc/clean_hands_protection/en/">Picture Source</a> 

  <a href="https://freesound.org/people/metrostock99/sounds/345086/ ">Sound Source</a>`;

    			t11 = space();
    			audio_1 = element("audio");
    			audio_1.innerHTML = `<track kind="captions"/><source src="sound.wav"/>`;
    			attr(h10, "class", "svelte-t08oh0");
    			attr(h11, "class", "svelte-t08oh0");
    			attr(h3, "class", "svelte-t08oh0");
    		},
    		m(target, anchor) {
    			insert(target, h10, anchor);
    			insert(target, t1, anchor);
    			mount_component(timer2tween, target, anchor);
    			insert(target, t2, anchor);
    			mount_component(howto0, target, anchor);
    			insert(target, t3, anchor);
    			insert(target, h11, anchor);
    			insert(target, t5, anchor);
    			mount_component(timer, target, anchor);
    			insert(target, t6, anchor);
    			mount_component(howto1, target, anchor);
    			insert(target, t7, anchor);
    			insert(target, h3, anchor);
    			insert(target, t11, anchor);
    			insert(target, audio_1, anchor);
    			/*audio_1_binding*/ ctx[2](audio_1);
    			current = true;
    		},
    		p: noop,
    		i(local) {
    			if (current) return;
    			transition_in(timer2tween.$$.fragment, local);
    			transition_in(howto0.$$.fragment, local);
    			transition_in(timer.$$.fragment, local);
    			transition_in(howto1.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(timer2tween.$$.fragment, local);
    			transition_out(howto0.$$.fragment, local);
    			transition_out(timer.$$.fragment, local);
    			transition_out(howto1.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(h10);
    			if (detaching) detach(t1);
    			destroy_component(timer2tween, detaching);
    			if (detaching) detach(t2);
    			destroy_component(howto0, detaching);
    			if (detaching) detach(t3);
    			if (detaching) detach(h11);
    			if (detaching) detach(t5);
    			destroy_component(timer, detaching);
    			if (detaching) detach(t6);
    			destroy_component(howto1, detaching);
    			if (detaching) detach(t7);
    			if (detaching) detach(h3);
    			if (detaching) detach(t11);
    			if (detaching) detach(audio_1);
    			/*audio_1_binding*/ ctx[2](null);
    		}
    	};
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let audio;

    	function timerEnds() {
    		audio.play();
    	}

    	function audio_1_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			audio = $$value;
    			$$invalidate(0, audio);
    		});
    	}

    	return [audio, timerEnds, audio_1_binding];
    }

    class App extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$3, create_fragment$4, safe_not_equal, {});
    	}
    }

    const app = new App({
    	target: document.body
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
