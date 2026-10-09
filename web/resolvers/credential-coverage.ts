import type { CredentialCoverageInput } from '../services/credential-coverage';
import type { CredentialCoverageData } from '../components/coverage/credential/types';
import { familyHref } from './families';
import { int } from './format';
import { resolvePipelineStamp } from './run';

const REPO = 'https://github.com/redact-secret/redact-secret-benchmarks';

export function resolveCredentialCoverage({ evaluation, scope, dossiers, qualification }: CredentialCoverageInput): CredentialCoverageData {
  const measured = evaluation.run.state === 'measured' ? evaluation.run : undefined;
  const product = measured?.scanners.find(scanner => scanner.id === 'redact-secret');
  const identity = measured?.official?.scanners.find(scanner => scanner.id === 'redact-secret');
  const current = product?.version === scope.boundTo.release && product.mode === scope.boundTo.mode;
  const boundPopulation = qualification?.state === 'ready' ? qualification.view.populations.find(population =>
    population.population === measured?.official?.population && population.artifact.semanticDigest === measured?.official?.semanticDigest) : undefined;
  const boundProduct = boundPopulation?.artifact.scanners.find(scanner => scanner.id === 'redact-secret');
  const ready = evaluation.pipeline.authority === 'new' && evaluation.pipeline.view?.state === 'ready' && qualification?.state === 'ready'
    && !!identity && boundProduct?.version === product?.version && boundProduct?.configurationHash === identity.configurationHash;
  const familyView = ready ? qualification.view.families : [];
  const catalog = evaluation.catalog;
  const providers = [...catalog.taxonomy.providers.map(provider => ({ id: provider.id, name: provider.name })),
    ...(catalog.taxonomy.families.some(family => family.provider === null) ? [{ id: 'generic', name: 'Not provider-specific' }] : [])];
  const distribution = evaluation.support?.distribution;
  return {
    release: product?.version ? `${product.version} · ${measured!.mode === 'candidate' ? 'Candidate, unreleased' : 'Published'}` : 'Not recorded',
    configuration: product ? `${product.mode}${identity ? ` · configuration SHA-256 ${identity.configurationHash}` : ' · configuration digest not recorded'}` : 'Not recorded',
    binding: current ? 'Current: the declared scope matches the measured release and configuration.' : product
      ? `Historical scope: declared for ${scope.boundTo.release} · ${scope.boundTo.mode}. It does not qualify ${product.version ?? 'the unrecorded release'} · ${product.mode}.`
      : `Unknown: no measured product identity can be compared with the scope declared for ${scope.boundTo.release} · ${scope.boundTo.mode}.`,
    sourceRevision: `Scope source ${scope.readAt}; release source ${scope.boundTo.revision}. ${scope.boundTo.check}`,
    counts: [
      { label: 'Taxonomy families, not a support claim', value: int(catalog.taxonomy.families.length) },
      { label: 'Families with recorded capability declarations', value: 'Not recorded' },
      { label: 'Families with fixtures', value: int(catalog.taxonomy.families.filter(family => (catalog.fixturesByFamily.get(family.id)?.length ?? 0) > 0).length) },
      { label: 'Families in the bound qualification record', value: evaluation.support ? int(evaluation.support.familyCount) : 'Not recorded' },
    ],
    support: evaluation.support && distribution
      ? `${evaluation.support.mode} ${evaluation.support.version}, recorded ${evaluation.support.generatedAt}: ${Object.entries(distribution).map(([state, total]) => `${int(total)} ${state}`).join(', ')}. These are benchmark classifications, separate from declared capability.`
      : 'No qualification record matches the measured product. Missing qualification is not unsupported capability.',
    pipeline: resolvePipelineStamp(evaluation.pipeline),
    scopeSource: `${REPO}/blob/develop/scanners/product-scope.json`,
    scope: [
      { title: 'Input and policy limitations', statements: scope.statements.filter(statement => statement.kind === 'product-scope').map(statement => statement.text) },
      { title: 'Activation and settings', statements: scope.statements.filter(statement => statement.kind === 'optional-profile').map(statement => statement.text) },
      { title: 'Surfaces not measured', statements: scope.statements.filter(statement => statement.kind === 'unmeasured-surface').map(statement => statement.text) },
    ].filter(group => group.statements.length),
    providers: providers.map(provider => ({ ...provider, href: provider.id === 'generic' ? '/report/families/' : `/report/providers/?q=${encodeURIComponent(provider.name)}`,
      rows: catalog.taxonomy.families.filter(family => (family.provider ?? 'generic') === provider.id).map(family => {
        const dossier = dossiers.get(family.id);
        const recorded = familyView.filter(row => row.taxonomyFamilies.some(taxonomy => taxonomy.id === family.id));
        const format = dossier?.notes.filter(note => ['Shape', 'Current contract in core'].includes(note.label)).map(note => note.text).join(' ');
        return {
          id: family.id, name: family.name, href: familyHref(family.id), description: family.description,
          declaration: 'Unknown: no release/configuration-bound positive family declaration is recorded here. A detector mapping or evidence format does not establish capability.',
          qualification: recorded.length ? recorded.map(row => `${row.family}: ${row.status.value}${row.status.qualificationProfile ? ` (${row.status.qualificationProfile})` : ''}`).join('; ') : 'Not recorded for this family and measured product.',
          ...(recorded.length ? { qualificationHref: `/evaluation/qualification/families/${recorded[0].family}/` } : {}),
          format: format || 'Format requirements not recorded in this dossier.',
          context: recorded.length ? [...new Set(recorded.flatMap(row => row.contract.supportedContext))].join(', ') || 'Context requirements not recorded.' : 'Context requirements not recorded for this measured product.',
          research: dossier ? `Evidence research: ${dossier.verdict}${dossier.tier ? ` · ${dossier.tier}` : ''}${dossier.blockedBy ? ` · ${dossier.blockedBy}` : ''}. Research readiness and evidence level are not product capability.` : 'Evidence research not recorded.',
          sources: (dossier?.sources ?? family.sources ?? []).map(href => ({ href, label: 'Recorded format source' })),
        };
      }) })).filter(provider => provider.rows.length),
  };
}
