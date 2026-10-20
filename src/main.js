import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Toast from 'vue-toastification'
import 'vue-toastification/dist/index.css'
import App from './App.vue'
import router from './router'
import './style.css'

createApp(App)
  .use(createPinia())
  .use(router)
  .use(Toast, { position: 'top-center', timeout: 3500 })
  .mount('#app')
