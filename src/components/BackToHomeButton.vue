<template>
    <router-link to="/" class="back-to-home-button">
      <img src="../assets/home-icon.png" alt="Home" />
      Back to Home
    </router-link>
  </template>
  
  <script lang="ts">
  import { defineComponent } from 'vue';
  
  export default defineComponent({
    name: 'BackToHomeButton',
  });
  </script>
  
  <style scoped>
  .back-to-home-button {
    position: absolute;
    top: 10px;
    right: 10px;
    display: flex;
    align-items: center;
    text-decoration: none;
    background-color: #007bff;
    color: white;
    padding: 5px 10px;
    border-radius: 5px;
    font-size: 14px;
  }
  
  .back-to-home-button img {
    width: 20px;
    height: 20px;
    margin-right: 5px;
  }
  
  .back-to-home-button:hover {
    background-color: #0056b3;
  }
  </style>