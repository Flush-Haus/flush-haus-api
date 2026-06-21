# Protocolo de Comunicação (Poker)

Este protocolo usa mensagens de texto em linha única, com parâmetros estritamente posicionais.

## 1. Convenções de Formato

- Cada mensagem deve ser enviada em uma única linha.
- Os tokens são separados por espaço.
- O comando sempre começa com domínio e ação (exemplo: session create, game action).
- Os parâmetros são sempre posicionais.
- Quando houver lista variável, o comando traz antes um campo de contagem e a lista variável sempre fica no final da mensagem.
- Valores de fichas são inteiros.
- Nomes de parâmetros seguem sufixos semânticos:
  - playerId: identificador de jogador.
  - amount: valor de fichas.
  - count: quantidade de itens.
  - phase: fase da rodada.
  - ms: tempo em milissegundos.
  - Formato de carta: [valor][naipe]
  - valor: 2 3 4 5 6 7 8 9 10 V D R A
  - naipe: P O C E
  - P = paus, O = ouros, C = copas, E = espadas

## 2. Gerenciamento da Sessão

O gerenciamento da sessão ocorre em dois momentos:

1. Antes do jogo: a sessão está em lobby aguardando o owner executar session start.
2. Durante o jogo: novos players entram como waiting e passam a jogar na próxima rodada.

Comandos marcados com owner only só podem ser executados por quem criou a sessão. |

### 2.1 Do Cliente para o Servidor

| Comando                                                                 | Descrição                                   |
| ----------------------------------------------------------------------- | ------------------------------------------- |
| session create [playerName]                                             | Cria uma nova sessão e entra como owner     |
| session join [sessionId] [playerName]                                   | Entra em uma sessão existente               |
| session leave                                                           | Sai da sessão atual                         |
| session players                                                         | Solicita snapshot atual da sessão           |
| session ban [targetPlayerId]                                            | Bane um usuário da sessão (owner only)      |
| session unban [targetPlayerId]                                          | Remove banimento de um usuário (owner only) |
| session start [smallBlindAmount] [bigBlindAmount] [startingChipsAmount] | Inicia o jogo (owner only)                  |
| session ping [clientUnixMs]                                             | Heartbeat de conexão                        |

### 2.2 Do Servidor para o Cliente

| Comando                                                                                                                                                            | Descrição                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| session created [sessionId] [ownerPlayerId]                                                                                                                        | Confirma criação da sessão                                    |
| session joined [sessionId] [selfPlayerId]                                                                                                                          | Confirma entrada na sessão                                    |
| session info [sessionId] [sessionState] [ownerPlayerId] [playersCount] [playerId_1] [playerName_1] [playerState_1] ... [playerId_N] [playerName_N] [playerState_N] | Snapshot completo da sessão                                   |
| session player_joined [playerId] [playerName]                                                                                                                      | Notifica entrada de player                                    |
| session player_left [playerId]                                                                                                                                     | Notifica saída de player                                      |
| session player_banned [playerId]                                                                                                                                   | Notifica banimento                                            |
| session player_unbanned [playerId]                                                                                                                                 | Notifica remoção de banimento                                 |
| session waiting_round_end                                                                                                                                          | Informa que o novo player deve aguardar o fim da rodada atual |
| session started [smallBlindAmount] [bigBlindAmount] [startingChipsAmount]                                                                                          | Indica início do jogo                                         |
| session pong [clientUnixMs] [serverUnixMs]                                                                                                                         | Resposta ao ping                                              |
| session closed [closeReasonCode]                                                                                                                                   | Sessão encerrada                                              |

## 3. Jogo

### 3.1 Do Cliente para o Servidor

| Comando                    | Descrição                                                       |
| -------------------------- | --------------------------------------------------------------- |
| game ready                 | Confirma que o cliente está pronto para receber eventos de jogo |
| game fold                  | Ação de desistir da mão                                         |
| game check                 | Ação de passar                                                  |
| game call                  | Ação de pagar valor atual                                       |
| game bet [betAmount]       | Ação de apostar (quando ainda não há aposta ativa)              |
| game raise [raiseToAmount] | Ação de aumentar para o valor total raiseToAmount               |
| game all_in                | Ação de all-in                                                  |

### 3.2 Do Servidor para o Cliente

| Comando                                                                                                                                                                                                                             | Descrição                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| game info [playersCount] [playerId_1] [chipsAmount_1] ... [playerId_N] [chipsAmount_N]                                                                                                                                              | Informa a quantidade de fichas de cada player                   |
| game round_start [dealerPlayerId] [smallBlindPlayerId] [bigBlindPlayerId] [smallBlindAmount] [bigBlindAmount] [seatsCount] [seatPosition_1] [seatPlayerId_1] ... [seatPosition_N] [seatPlayerId_N]                                  | Início de nova rodada com ordem/posição da mesa                 |
| game hole [card1] [card2]                                                                                                                                                                                                           | Cartas privadas do player (mensagem individual)                 |
| game turn [actingPlayerId] [toCallAmount] [minRaiseToAmount] [maxRaiseToAmount] [actionTimeMs]                                                                                                                                      | Notifica turno de ação com regra dinâmica de raise              |
| game action [playerId] [actionType] [actionAmount] [potTotalAmount] [playerChipsAmount]                                                                                                                                             | Broadcast da ação executada                                     |
| game bets [playersCount] [playerId_1] [betAmount_1] ... [playerId_N] [betAmount_N]                                                                                                                                                  | Informa quanto cada player já apostou na rodada atual           |
| game pots [potsCount] [potType_1] [potAmount_1] [eligiblePlayersCount_1] [eligiblePlayerId_1_1] ... [eligiblePlayerId_1_M] ... [potType_N] [potAmount_N] [eligiblePlayersCount_N] [eligiblePlayerId_N_1] ... [eligiblePlayerId_N_K] | Informa main pot e side pot(s), incluindo elegibilidade por pot |
| game board_flop [card1] [card2] [card3]                                                                                                                                                                                             | Revela flop                                                     |
| game board_turn [card]                                                                                                                                                                                                              | Revela turn                                                     |
| game board_river [card]                                                                                                                                                                                                             | Revela river                                                    |
| game showdown [revealedCount] [playerId_1] [cardA_1] [cardB_1] ... [playerId_N] [cardA_N] [cardB_N]                                                                                                                                 | Revela cartas no showdown                                       |
| game result [winnersCount] [winnerPlayerId_1] [winAmount_1] [handRank_1] ... [winnerPlayerId_N] [winAmount_N] [handRank_N]                                                                                                          | Resultado da mão                                                |
| game chips [playersCount] [playerId_1] [chipsAmount_1] ... [playerId_N] [chipsAmount_N]                                                                                                                                             | Snapshot de fichas após resultado                               |
| game eliminated [playerId] [finishPosition]                                                                                                                                                                                         | Notifica eliminação                                             |
| game over [winnerPlayerId]                                                                                                                                                                                                          | Encerramento da partida                                         |

## 4. Controle e Erros

### 4.1 Do Servidor para o Cliente

| Comando                                                                    | Descrição                      |
| -------------------------------------------------------------------------- | ------------------------------ |
| ok [requestCommand]                                                        | Confirma execução bem-sucedida |
| error [requestCommand] [errorCode] [detailCount] [detail_1] ... [detail_N] | Retorna erro padronizado       |

### 4.2 Parâmetros com Enum (Controle)

| Parâmetro | Valores                                                                                                                                                                                                                                                                   |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| errorCode | ERR_UNKNOWN_COMMAND, ERR_INVALID_PARAMS, ERR_NOT_OWNER, ERR_SESSION_NOT_FOUND, ERR_SESSION_FULL, ERR_PLAYER_BANNED, ERR_GAME_ALREADY_STARTED, ERR_GAME_NOT_STARTED, ERR_NOT_YOUR_TURN, ERR_INVALID_ACTION, ERR_INSUFFICIENT_CHIPS, ERR_PLAYER_NOT_IN_SESSION, ERR_TIMEOUT |

## 5. Fluxo de Exemplo (Resumo)

### 5.1 Sessão + Setup

1 [player_000 -> S] session create Heitor
2 [S -> player_000] session created session_000 player_000

3 [player_001 -> S] session join session_000 Diego
4 [S -> all] session player_joined player_001 Diego

5 [player_000 -> S] session start 5 10 1000
6 [S -> all] session started 5 10 1000

7 [player_000 -> S] game ready
7 [player_001 -> S] game ready

8 [S -> all] game info 2 player_000 1000 player_001 1000

### 5.2 Rodada 1 (call + check + showdown simples)

9 [S -> all] game round_start player_000 player_000 player_001 5 10 2 0 player_000 1 player_001

10 [S -> player_000] game hole AC RO
10 [S -> player_001] game hole 9P 9E

11 [S -> all] game turn player_001 10 20 1000 15000
12 [player_001 -> S] game call
13 [S -> all] game action player_001 call 10 20 990

14 [S -> all] game turn player_000 0 20 1000 15000
15 [player_000 -> S] game check
16 [S -> all] game action player_000 check 0 20 1000

17 [S -> all] game bets 2 player_000 10 player_001 10
18 [S -> all] game pots 1 MAIN 20 2 player_000 player_001

19 [S -> all] game board_flop 2P 7O VE
20 [S -> all] game board_turn 3C
21 [S -> all] game board_river 8E

22 [S -> all] game showdown 2 player_000 AC RO player_001 9P 9E
23 [S -> all] game result 1 player_001 20 PAIR
24 [S -> all] game chips 2 player_000 990 player_001 1010

### 5.3 Rodada 2 (raise + fold)

25 [S -> all] game round_start player_001 player_001 player_000 5 10 2 0 player_000 1 player_001

26 [S -> player_000] game hole KD QC
26 [S -> player_001] game hole AH AD

27 [S -> all] game turn player_000 10 20 1000 15000
28 [player_000 -> S] game raise 40
29 [S -> all] game action player_000 raise 40 50 950

30 [S -> all] game turn player_001 40 80 1000 15000
31 [player_001 -> S] game fold
32 [S -> all] game action player_001 fold 0 50 1010

33 [S -> all] game result 1 player_000 50 NONE
34 [S -> all] game chips 2 player_000 1040 player_001 1010

### Rodada 3 (all-in)

35 [S -> all] game round_start player_000 player_000 player_001 5 10 2 0 player_000 1 player_001

36 [S -> player_000] game hole 2C 2E
36 [S -> player_001] game hole AK AE

37 [S -> all] game turn player_001 10 20 1000 15000
38 [player_001 -> S] game raise 200
39 [S -> all] game action player_001 raise 200 210 810

40 [S -> all] game turn player_000 200 400 1040 15000
41 [player_000 -> S] game all_in
42 [S -> all] game action player_000 all_in 1040 1250 0

[S -> all] game pots 2 MAIN 2020 2 player_000 player_001 SIDE 30 1 player_000

44 [S -> all] game board_flop 2P 7C 9O
45 [S -> all] game board_turn KC
46 [S -> all] game board_river AD

47 [S -> all] game showdown 2 player_000 2C 2E player_001 AK AE

48 [S -> all] game result 1 player_000 2050 THREE_OF_A_KIND
49 [S -> all] game chips 2 player_000 2050 player_001 0
50 [S -> all] game eliminated player_001 2
51 [S -> all] game over player_000
