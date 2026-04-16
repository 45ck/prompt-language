import Client from './client';
import ClientStore from './client-store';

class App {
  constructor() {
    this.client = new Client();
    this.clientStore = new ClientStore();
  }
}

export default App;
