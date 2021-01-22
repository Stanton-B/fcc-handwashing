<script>
  import { createEventDispatcher } from "svelte";

  import { tweened } from "svelte/motion";
  import { cubicOut } from "svelte/easing";

  /* For talking to the parent App.svelte */
  const dispatch = createEventDispatcher();

  // track whether the timer is in progress
  let isRunning = false;
  let paused = false;
  let resetDuration = 400;
  // seconds for the timer
  let seconds = 20;

  // We make this reactive($:) because when `seconds` changes, this needs to
  // recompute.
  $: milliseconds = seconds * 1000;

  // Tying the duration to `milliseconds` and making the assignment reactive
  // ($:) allows to change value
  $: progressStore = tweened(seconds, {
    duration: milliseconds,
  });

  // set progress to 0 (tweening for the period computed in the milliseconds variable).
  async function start() {
    paused = false;
    isRunning = true;
    await progressStore.set(0);
    // then, when timer reaches 0
    progressStore.set(seconds, { duration: resetDuration, easing: cubicOut });
    isRunning = false;
    console.log("Timer2 Complete");
    dispatch("end");
  }

  function stop() {
    paused = false;
    isRunning = false;
    progressStore.set(seconds, { duration: resetDuration, easing: cubicOut });
  }

  function pause() {
    if (paused) {
      start();
    } else {
      paused = true;
      progressStore.set($progressStore, {
        duration: resetDuration,
        easing: cubicOut,
      });
    }
  }
</script>

<style>
  button {
    color: white;
    background-color: rgb(22, 55, 33);
    height: 3rem;
    width: 100%;
    margin: 10px 0;
    padding: 5px 5px;
  }

  button:hover {
    background-color: rgb(66, 120, 88);
    width: 100%;
  }

  progress,
  input {
    display: block;
    width: 100%;
  }
</style>

<div bp="grid">
  <h2 bp="offset-5@md 4@md 12@sm">
    Seconds Left:
    {$progressStore < 10 ? `0${Math.floor($progressStore)}` : `${Math.floor($progressStore)}`}
  </h2>
</div>

<div bp="grid">
  <div class="progress-container" bp="offset-5@md 4@md 12@sm">
    <progress value={$progressStore} min="0" max={seconds} />
    <input
      type="range"
      bind:value={seconds}
      on:change={stop}
      min="1"
      max="60" />
  </div>
</div>

<div bp="grid">
  {#if !isRunning || paused}
    <button bp="offset-5@md 4@md 12@sm" on:click={start}>⏱ Start</button>
  {:else}
    <button bp="offset-5@md 4@md 12@sm" on:click={pause}>⏸ Pause</button>
  {/if}
  <button bp="offset-5@md 4@md 12@sm" on:click={stop}>♻ Reset</button>
</div>
