<?php
// Exemplo: validando o token em PHP (qualquer linguagem com HTTP funciona igual).

$resposta = file_get_contents('http://localhost:8787/v1/verify', false, stream_context_create([
    'http' => [
        'method'  => 'POST',
        'header'  => "Content-Type: application/json\r\n",
        'content' => json_encode([
            'secret' => getenv('HUMNOVO_SECRET_KEY'),
            'token'  => $_POST['humnovo-token'] ?? '',
        ]),
        'ignore_errors' => true,
    ],
]));

$resultado = json_decode($resposta, true);

if (!empty($resultado['success'])) {
    echo 'Humano verificado!';
} else {
    http_response_code(400);
    echo 'Verificação falhou.';
}
