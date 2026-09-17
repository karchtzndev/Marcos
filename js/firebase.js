/**
 * 🔥 Firebase Config - O Markin
 * Inicialização centralizada do Firebase
 */

// Configuração do Firebase (substituir com seus valores)
const firebaseConfig = {
  apiKey: 'AIzaSyCLv4QX2nK8dXe1mP6jJ-8vRtUx7Y9zAbC',
  authDomain: 'omarkin-chef.firebaseapp.com',
  projectId: 'omarkin-chef',
  storageBucket: 'omarkin-chef.appspot.com',
  messagingSenderId: '123456789012',
  appId: '1:123456789012:web:abc123def456ghi789',
  databaseURL: 'https://omarkin-chef.firebaseio.com'
};

// Inicializar Firebase (compatibilidade com código existente)
const FirebaseHelper = {
  // Verificar se Firebase está inicializado
  isInitialized() {
    return typeof firebase !== 'undefined' &&
           typeof firebase.firestore !== 'undefined';
  },

  // Delay para garantir que Firestore está pronto
  async waitForFirestore(timeout = 5000) {
    const start = Date.now();
    while (!this.isInitialized()) {
      if (Date.now() - start > timeout) {
        throw new Error('Firebase não inicializou no tempo limite');
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  },

  // Helper para operações comuns
  async getCollection(collectionName, query = null) {
    try {
      await this.waitForFirestore();
      let ref = db.collection(collectionName);

      if (query) {
        if (query.where) {
          ref = ref.where(query.where[0], query.where[1], query.where[2]);
        }
        if (query.orderBy) {
          ref = ref.orderBy(query.orderBy[0], query.orderBy[1]);
        }
        if (query.limit) {
          ref = ref.limit(query.limit);
        }
      }

      const snapshot = await ref.get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error(`Erro ao buscar ${collectionName}:`, error);
      throw error;
    }
  },

  // Listener em tempo real
  onCollection(collectionName, callback, query = null) {
    try {
      let ref = db.collection(collectionName);

      if (query) {
        if (query.where) {
          ref = ref.where(query.where[0], query.where[1], query.where[2]);
        }
        if (query.orderBy) {
          ref = ref.orderBy(query.orderBy[0], query.orderBy[1]);
        }
        if (query.limit) {
          ref = ref.limit(query.limit);
        }
      }

      return ref.onSnapshot(
        snapshot => {
          const data = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          callback(data, null);
        },
        error => {
          console.error(`Erro ao ouvir ${collectionName}:`, error);
          callback(null, error);
        }
      );
    } catch (error) {
      console.error(`Erro ao configurar listener ${collectionName}:`, error);
      callback(null, error);
    }
  },

  // Batch write (múltiplos documentos)
  async batchWrite(operations) {
    try {
      await this.waitForFirestore();
      const batch = db.batch();

      for (const op of operations) {
        if (op.type === 'set') {
          batch.set(op.ref, op.data, op.options);
        } else if (op.type === 'update') {
          batch.update(op.ref, op.data);
        } else if (op.type === 'delete') {
          batch.delete(op.ref);
        }
      }

      await batch.commit();
    } catch (error) {
      console.error('Erro ao executar batch write:', error);
      throw error;
    }
  },

  // Retry automático para operações com falha de rede
  async retryOperation(fn, maxRetries = 3, delayMs = 1000) {
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        // Só fazer retry se for erro de rede/timeout
        if (!error.message.includes('network') &&
            !error.message.includes('timeout') &&
            i < maxRetries - 1) {
          throw error; // Erro não-retentável
        }

        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, delayMs * (i + 1)));
        }
      }
    }

    throw lastError;
  },
};

// Exportar
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FirebaseHelper;
}
