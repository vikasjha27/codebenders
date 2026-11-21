import { Spinner } from '../../components/Spinner';
import { formatINR } from '../../domain/money';
import { useAppData } from '../../storage/AppDataProvider';

export function StudentsPage(): JSX.Element {
  const { status, data } = useAppData();
  if (status === 'loading') return <Spinner />;

  return (
    <section>
      <h1>Students</h1>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Parent</th>
              <th>Class</th>
              <th>Subject</th>
              <th className="num">Fee</th>
              <th className="num">Due day</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.students.map((s) => (
              <tr key={s.id}>
                <td>{s.studentName}</td>
                <td>
                  {s.parentName}
                  {s.parentPhone && <div className="muted small">{s.parentPhone}</div>}
                </td>
                <td>{s.className}</td>
                <td>{s.subject}</td>
                <td className="num">
                  {formatINR(s.feeAmount)}
                  <span className="muted">{s.feeModel === 'monthly' ? '/month' : '/session'}</span>
                </td>
                <td className="num">{s.dueDay}</td>
                <td>{s.active ? 'Active' : 'Inactive'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
