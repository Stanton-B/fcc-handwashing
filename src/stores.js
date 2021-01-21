<script>
  import {tweened} from 'svelte/store';
  import {cubicOut} from 'svelte/easing';

  const progress = tweened(0, {
    duration: 400,
    easing: cubicOut
  })
</script>


