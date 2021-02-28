<script>
  import { createEventDispatcher } from "svelte";
  import { tweened } from "svelte/motion";
  import { cubicOut } from "svelte/easing";

  const dispatch = createEventDispatcher();
  let isRunning = false;
  let paused = false;
  let resetDuration = 400;
  let seconds = 20;
  $: milliseconds = seconds * 1000;
  $: progressStore = tweened(seconds, {
    duration: milliseconds,
  });

  async function start(time) {
    paused = false;
    isRunning = true;
    while (!paused && isRunning) {
      let timerDuration = time <= 1 ? 1 : Math.round(time) * 1000;
      await progressStore.set(0, { duration: timerDuration });
      console.log("Timer2 Complete");
      dispatch("end");
      reset();
      return;
    }
    return;
  }

  function reset() {
    paused = false;
    isRunning = false;
    progressStore.set(seconds, { duration: resetDuration, easing: cubicOut });
  }

  function pause() {
    if (paused) {
      start($progressStore);
    } else {
      paused = true;
      progressStore.set($progressStore, { duration: 0 });
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
    {$progressStore < 9.5 ? `0${Math.round($progressStore)}` : `${Math.round($progressStore)}`}
  </h2>
</div>

<div bp="grid">
  <div class="progress-container" bp="offset-5@md 4@md 12@sm">
    <progress value={$progressStore} min="0" max={seconds} />
    <input
      type="range"
      bind:value={seconds}
      on:change={reset}
      min="1"
      max="60" />
  </div>
</div>

<div bp="grid">
  {#if !isRunning || paused}
    <button bp="offset-5@md 4@md 12@sm" on:click={start($progressStore)}>⏱ Start</button>
  {:else}
    <button bp="offset-5@md 4@md 12@sm" on:click={pause}>⏸ Pause</button>
  {/if}
  <button bp="offset-5@md 4@md 12@sm" on:click={reset}>♻ Reset</button>
</div>
