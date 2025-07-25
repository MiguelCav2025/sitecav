export default function CursosPage() {
  const cursos = [
    {
      titulo: "Animação",
      descricao: "O curso de Animação oferece formação inicial para animadores e criadores na área, aliando arte, técnica e reflexão crítica. Ao longo dos 3 semestres, o aluno compreende as técnicas elementares para se realizar uma animação, ao mesmo tempo em que vivencia o processo criativo de produtos audiovisuais dessa natureza.",
      objetivos: "Formar um profissional que seja capaz de se inserir no mercado de animação, partindo dos conceitos primordiais da animação tradicional até a animação digital 2D.",
      programa: [
        "1º semestre: Aquisição de repertório, exercícios em animação tradicional, layout, desenho, roteiro, entre outros.",
        "2º semestre: Início do Projeto Integrado de Animação. Escrita de roteiro, pitching e avaliação em banca do Animatic.",
        "3º semestre: Continuidade do Projeto Integrado. Disciplinas específicas e assessorias. Entrega de um curta-metragem e avaliação final por banca."
      ],
      duracao: "3 semestres (1 ano e meio)",
      cargaHoraria: "Cerca de 800 horas",
      nivel: "Curso livre de viés profissionalizante",
      processoSeletivo: "Para se ter acesso a este curso o aluno precisa realizar uma prova específica, com questões de nível básico em desenho.",
      diferenciais: [
        { titulo: "Animação Tradicional", desc: "Aulas de animação tradicional utilizando mesas de luz e ministradas por Arte-Educadores especialistas." },
        { titulo: "Desenvolvimento de Projetos", desc: "Alunos vivenciam todas as etapas de uma produção, com acompanhamento de profissionais do Núcleo de Produção." },
        { titulo: "Laboratórios", desc: "Aulas práticas e teóricas em laboratórios digitais com softwares e equipamentos de última geração." }
      ]
    },
    {
      titulo: "Cine/TV",
      descricao: "Cine/TV é o curso voltado para os iniciantes no audiovisual. Em 3 semestres o curso permite a compreensão dos processos de realização para cinema, televisão e mídias digitais, focado em oferecer ao aluno um primeiro contato com a produção de trabalhos/projetos audiovisuais de curta duração.",
      objetivos: "Formar um profissional que seja capaz de se inserir no mercado, com um olhar múltiplo e criativo, transitando entre as diferentes naturezas e plataformas do audiovisual contemporâneo.",
      programa: [
        "1º semestre: Foco em repertório com disciplinas voltadas para a Arte, História do Audiovisual e conceitos básicos para a realização de filmes.",
        "2º semestre: Realização do Projeto Integrado com um curta-metragem de ficção de até 5 minutos. Avaliação por banca.",
        "3º semestre: Projeto Integrado com um curta-metragem de até 15 minutos, de gênero livre. Escolha via pitching e produção com orientação. Avaliação final por banca."
      ],
      duracao: "3 semestres (1 ano e meio)",
      cargaHoraria: "Cerca de 800 horas",
      nivel: "Curso livre de viés profissionalizante",
      processoSeletivo: "Para se ter acesso a este curso o aluno precisa realizar uma prova específica.",
      diferenciais: [
        { titulo: "Escrita e Reflexão", desc: "Alunos adquirem habilidades de escrita e refletem sobre o processo criativo para o desenvolvimento de obras audiovisuais." },
        { titulo: "Produção", desc: "Desenvolvimento de projetos onde os alunos vivenciam todas as etapas de uma produção real." },
        { titulo: "Pós-produção", desc: "Aulas práticas de montagem e finalização para capacitar os alunos a editarem e finalizarem suas produções." }
      ]
    }
  ];

  return (
    <div className="bg-blue-900 min-h-screen section-responsive">
      <div className="container mx-auto container-responsive">
        <div className="text-center spacing-section">
          <h1 className="text-hero text-white mb-4">Nossos Cursos</h1>
          <p className="text-responsive text-[#fd9801] max-w-3xl mx-auto">
            Explore os detalhes dos nossos cursos de formação em Animação e Cine/TV.
          </p>
        </div>

        <div className="space-y-16">
          {cursos.map((curso, index) => (
            <section key={index} id={curso.titulo.toLowerCase().replace('/', '')}>
              <div className="bg-white card-responsive rounded-2xl shadow-2xl">
                <h2 className="text-subsection mb-4 text-orange-500">{curso.titulo}</h2>
                <p className="text-responsive mb-6 text-gray-900">{curso.descricao}</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-responsive mb-6">
                  <div>
                    <h3 className="text-card-title mb-2 text-orange-500">Objetivos</h3>
                    <p className="text-small-responsive text-gray-900">{curso.objetivos}</p>
                  </div>
                  <div>
                    <h3 className="text-card-title mb-2 text-orange-500">Estrutura do Curso</h3>
                    <ul className="list-disc list-inside space-y-2 text-small-responsive text-gray-900">
                      {curso.programa.map((item, i) => {
                        // Divide o texto no primeiro ":" para separar semestre do conteúdo
                        const colonIndex = item.indexOf(':');
                        if (colonIndex !== -1) {
                          const semestre = item.substring(0, colonIndex);
                          const conteudo = item.substring(colonIndex);
                          return (
                            <li key={i}>
                              <strong className="text-gray-900">{semestre}</strong>{conteudo}
                            </li>
                          );
                        }
                        return <li key={i}>{item}</li>;
                      })}
                    </ul>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-responsive text-center mb-6 card-responsive bg-blue-100 rounded-lg">
                  <div>
                    <p className="font-bold text-responsive text-blue-800">Duração</p>
                    <p className="text-small-responsive text-blue-700">{curso.duracao}</p>
                  </div>
                  <div>
                    <p className="font-bold text-responsive text-blue-800">Carga Horária</p>
                    <p className="text-small-responsive text-blue-700">{curso.cargaHoraria}</p>
                  </div>
                  <div>
                    <p className="font-bold text-responsive text-blue-800">Nível</p>
                    <p className="text-small-responsive text-blue-700">{curso.nivel}</p>
                  </div>
                </div>
                
                <div className="mb-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-responsive">
                    {curso.diferenciais.map((d, i) => (
                      <div key={i} className="card-responsive rounded-xl shadow-md bg-blue-100">
                        <h4 className="font-bold mb-2 text-small-responsive text-blue-800">{d.titulo}</h4>
                        <p className="text-small-responsive text-blue-700">{d.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="text-center card-responsive bg-blue-900 text-white rounded-lg">
                    <h4 className="font-semibold text-responsive">Processo Seletivo</h4>
                    <p className="text-small-responsive">{curso.processoSeletivo} <a href="/area-do-candidato" className="text-orange-400 hover:underline">Para mais informações, clique aqui.</a></p>
                </div>
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
} 