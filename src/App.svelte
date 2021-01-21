<script>
  import HowTo from "./HowTo.svelte";
  import Timer from "./Timer.svelte";
  import Timer2Tween from "./Timer2Tween.svelte";

  let audio;
  /* function timerEnds() { */
  /*   /1* audio.play(); *1/ */
  /*   console.log("END TIMER!"); */
  /* } */
</script>

<style>
  h1,
  h3 {
    text-align: center;
  }
</style>

<h1>Handwashing App</h1>
<Timer2Tween />
<HowTo />

<audio bind:this={audio}>
  <track kind="captions" />
  <source src="sound.wav" />
</audio>
