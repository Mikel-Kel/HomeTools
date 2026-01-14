<script setup lang="ts">
import PageHeader from "@/components/PageHeader.vue";
import axios from "axios";
import type { Contact } from "@/Types";
import { ref, onMounted } from "vue";

const contacts = ref<Contact[]>([]);
const newContact = ref({ name: "", email: "" });

const fetchContacts = async () => {
  try {
    const { data } = await axios.get(
      "http://localhost:3000/api/contacts"
    );
    contacts.value = data;
  } catch (error) {
    console.error("Error fetching contacts:", error);
  }
};

const addContact = async () => {
  try {
    const { data } = await axios.post(
      "http://localhost:3000/api/contacts",
      newContact.value
    );
    contacts.value.push(data);
    newContact.value = { name: "", email: "" };
  } catch (error) {
    console.error("Error adding contact:", error);
  }
};

onMounted(fetchContacts);
</script>

<template>
  <PageHeader title="Contact" icon="users" />
  <div class="contact-view">
    <!-- Liste des contacts -->
    <ul>
      <li v-for="contact in contacts" :key="contact.id">
        {{ contact.name }} – {{ contact.email }}
      </li>
    </ul>

    <!-- Formulaire d'ajout -->
    <form @submit.prevent="addContact">
      <input
        v-model="newContact.name"
        type="text"
        placeholder="Name"
        required
      />
      <input
        v-model="newContact.email"
        type="email"
        placeholder="Email"
        required
      />
      <button type="submit">Add Contact</button>
    </form>
  </div>
</template>

<style scoped>
.contact-view {
  padding: 1rem;
}

ul {
  list-style: none;
  padding: 0;
}

li {
  margin-bottom: 0.5rem;
}

form {
  margin-top: 1rem;
}

input {
  margin-right: 0.5rem;
  padding: 0.4rem;
}

button {
  padding: 0.4rem 0.8rem;
}

button:hover {
  background-color: #0056b3;
  color: white;
}
</style>