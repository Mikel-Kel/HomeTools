<template>
  <div class="homepage">
    <Title text="Welcome to HomeTools" icon="home.png" />  
      <ul>
        <li><router-link to="/authentication">Authentication</router-link></li>
        <li><router-link to="/spending">Spending</router-link></li>
        <li><router-link to="/contact">Contact</router-link></li>
      </ul>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import Title from './AppTitle.vue'; // Import the Title component

export default defineComponent({
  name: 'Homepage',
  components: {
    Title
  },
});
</script>

<style scoped>
nav {
  margin-top: 20px;
}

ul {
  list-style: none;
  padding: 0;
}

li {
  margin-bottom: 10px;
}

a {
  text-decoration: none;
  color: blue;
}

a:hover {
  text-decoration: underline;
}
</style>