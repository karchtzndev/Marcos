/**
 * 🔥 Firestore Optimization - O Markin
 * Estratégias avançadas para melhor performance
 */

const FirestoreOptimization = {
  // Cache em memória para queries frequentes
  queryCache: new Map(),
  cacheTTL: 5 * 60 * 1000, // 5 minutos

  // Query com cache automático
  async getCollectionCached(collectionName, query = null, cacheDuration = 5 * 60 * 1000) {
    const cacheKey = collectionName + JSON.stringify(query);

    // Verificar cache
    if (this.queryCache.has(cacheKey)) {
      const cached = this.queryCache.get(cacheKey);
      if (Date.now() - cached.timestamp < cacheDuration) {
        console.log(`[Cache Hit] ${cacheKey}`);
        return cached.data;
      }
    }

    // Buscar do Firestore
    const data = await FirebaseHelper.getCollection(collectionName, query);

    // Armazenar em cache
    this.queryCache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });

    return data;
  },

  // Limpar cache expirado
  cleanExpiredCache() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, value] of this.queryCache.entries()) {
      if (now - value.timestamp > this.cacheTTL) {
        this.queryCache.delete(key);
        cleaned++;
      }
    }

    console.log(`Cache cleanup: ${cleaned} entries removed`);
  },

  // Paginação eficiente
  async getPaginatedCollection(collectionName, pageSize = 20, query = null) {
    let lastDoc = null;
    const pages = [];

    return {
      async getFirstPage() {
        let ref = db.collection(collectionName);

        if (query?.where) {
          ref = ref.where(query.where[0], query.where[1], query.where[2]);
        }
        if (query?.orderBy) {
          ref = ref.orderBy(query.orderBy[0], query.orderBy[1]);
        }

        const snapshot = await ref.limit(pageSize).get();
        lastDoc = snapshot.docs[snapshot.docs.length - 1];

        pages.push(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        return pages[0];
      },

      async getNextPage() {
        if (!lastDoc) return [];

        let ref = db.collection(collectionName);

        if (query?.where) {
          ref = ref.where(query.where[0], query.where[1], query.where[2]);
        }
        if (query?.orderBy) {
          ref = ref.orderBy(query.orderBy[0], query.orderBy[1]);
        }

        const snapshot = await ref
          .startAfter(lastDoc)
          .limit(pageSize)
          .get();

        if (snapshot.empty) return [];

        lastDoc = snapshot.docs[snapshot.docs.length - 1];
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        pages.push(data);

        return data;
      },

      hasMore() {
        return lastDoc !== null;
      },

      reset() {
        lastDoc = null;
        pages.length = 0;
      }
    };
  },

  // Batch write otimizado
  async optimizedBatchWrite(operations, batchSize = 500) {
    const batches = [];

    for (let i = 0; i < operations.length; i += batchSize) {
      batches.push(operations.slice(i, i + batchSize));
    }

    for (const batch of batches) {
      const writeBatch = db.batch();

      for (const op of batch) {
        if (op.type === 'set') {
          writeBatch.set(op.ref, op.data, op.options);
        } else if (op.type === 'update') {
          writeBatch.update(op.ref, op.data);
        } else if (op.type === 'delete') {
          writeBatch.delete(op.ref);
        }
      }

      await writeBatch.commit();
    }

    console.log(`Batch write completed: ${operations.length} operations in ${batches.length} batches`);
  },

  // Listener com limite de documentos
  onCollectionLimited(collectionName, callback, limit = 50, query = null) {
    try {
      let ref = db.collection(collectionName);

      if (query?.where) {
        ref = ref.where(query.where[0], query.where[1], query.where[2]);
      }
      if (query?.orderBy) {
        ref = ref.orderBy(query.orderBy[0], query.orderBy[1]);
      }

      return ref.limit(limit).onSnapshot(
        snapshot => {
          const data = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          callback(data, null);
        },
        error => callback(null, error)
      );
    } catch (error) {
      console.error(`Erro ao ouvir ${collectionName}:`, error);
      callback(null, error);
    }
  },

  // Agregação local em vez de ler tudo
  async aggregateLocal(collectionName, query, aggregateFn) {
    const data = await FirebaseHelper.getCollection(collectionName, query);
    return aggregateFn(data);
  },

  // Exemplo: Somar totais sem ler tudo
  async getTotalSalesDay(date) {
    const today = new Date(date).toISOString().split('T')[0];

    const sales = await this.getCollectionCached('pedidos', {
      where: ['paidAt', '>=', today + 'T00:00:00Z'],
      limit: 1000
    });

    return sales.reduce((sum, order) => sum + (order.total || 0), 0);
  },

  // Compressão de dados (remover campos desnecessários)
  compressDocument(doc) {
    const compressed = { ...doc };

    // Remover campos que não precisam
    delete compressed.tempData;
    delete compressed.debugInfo;

    return compressed;
  },

  // Índices recomendados (para documentação)
  getRecommendedIndexes() {
    return [
      {
        collection: 'pedidos',
        fields: [
          { fieldPath: 'status', order: 'ASCENDING' },
          { fieldPath: 'createdAt', order: 'DESCENDING' }
        ],
        query: 'Get pedidos by status and date'
      },
      {
        collection: 'visitas',
        fields: [
          { fieldPath: 'entrada', order: 'DESCENDING' }
        ],
        query: 'Get recent visits'
      },
      {
        collection: 'pedidos',
        fields: [
          { fieldPath: 'telefone', order: 'ASCENDING' },
          { fieldPath: 'createdAt', order: 'DESCENDING' }
        ],
        query: 'Get customer orders'
      }
    ];
  },

  // Monitorar uso de leitura/escrita
  reportStats() {
    const stats = {
      cacheSize: this.queryCache.size,
      cacheMemory: `${(new TextEncoder().encode(JSON.stringify(Array.from(this.queryCache.entries()))).length / 1024).toFixed(2)} KB`,
      entries: Array.from(this.queryCache.keys())
    };

    console.table(stats);
    return stats;
  }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FirestoreOptimization;
}
