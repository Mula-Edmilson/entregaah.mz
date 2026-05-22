# Correções aplicadas

## 1. Tabelas no mobile
- As tabelas do admin agora passam para formato de cartões em ecrãs pequenos.
- O layout desktop foi mantido.
- Foi adicionada uma rotina JavaScript que coloca automaticamente os rótulos das colunas em cada célula no mobile.

## 2. Método de pagamento
- Corrigido o backend para aceitar e guardar corretamente `payment_method`.
- Antes, o validador removia este campo e o sistema caía sempre no valor padrão `cash`.
- Histórico, extrato e detalhes agora usam labels consistentes para Dinheiro, M-Pesa, E-Mola, M-Kesh e Transferência Bancária.

## 3. Motoristas no mapa em tempo real
- Adicionado armazenamento da última localização do motorista no perfil.
- Adicionado endpoint de fallback: `GET /api/drivers/live-locations`.
- O mapa agora usa socket em tempo real e também sincronização periódica com o backend.
- Estados `online_livre`, `online_ocupado`, `em_recolha` e `em_entrega` são considerados online para mapa e dashboard.

## 4. Dashboard e Desempenho dos Serviços
- Corrigida a contagem de encomendas em trânsito.
- Corrigida a contagem de motoristas online.
- O gráfico de desempenho agora recebe sempre os serviços em ordem fixa, mesmo quando algum serviço não tem dados.
- O gráfico foi ajustado para separar pedidos e receita em eixos diferentes, evitando leituras falsas.
- Foi reforçada a destruição de instâncias antigas do Chart.js para evitar falhas de renderização.

## Validação feita
- Todos os ficheiros JavaScript principais do frontend e backend passaram em `node --check`.
- Não foi feito teste de base de dados em produção porque este ambiente não tem as credenciais/MongoDB do projecto.
