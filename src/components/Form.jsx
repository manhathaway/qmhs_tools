import { useMemo, useState, useEffect } from 'react';
import css from './Form.module.css';
import {
    FORM_SCHEMA,
    SALESMEN,
    SELECT_DATA
} from '../data';
import {
    buildInitialState,
    updateField,
    updateCheckbox,
    addRow,
    updateRow,
    removeRow,
    formatCurrency
} from '../formHelpers';
import Dialog from './Dialog';
import DynamicSection from './subcomponents/DynamicSection';
import JobDescriptionDialog from './subcomponents/JobDescriptionDialog';
import Button from './subcomponents/Button';

const Form = ({ prefillData, onPrefillConsumed }) => {
    const [formData, setFormData] = useState(() => {
        try {
            const localData = localStorage.getItem('formData');
            if (localData) return JSON.parse(localData);
        } catch (error) {
            console.warn("Error reading localStorage:", error);
        }
        return buildInitialState(FORM_SCHEMA);
    });

    useEffect(() => {
        try {
            localStorage.setItem('formData', JSON.stringify(formData));
        } catch (error) {
            console.error("Error saving localStorage:", error);
        }
    }, [formData]);

    useEffect(() => {
        if (!prefillData) return;

        setFormData(() => ({
            ...buildInitialState(FORM_SCHEMA),
            ...prefillData,
        }));

        if (onPrefillConsumed) {
            onPrefillConsumed();
        }
    }, [prefillData, onPrefillConsumed]);

    const selectedSalesman = useMemo(() => {
        return SALESMEN.list.find(
            p => p.value === formData.salesman
        );
    }, [formData.salesman]);

    const isEnabled = (field) => {
        if (!field.enabledWhen) return true;
        return field.enabledWhen(formData, { selectedSalesman });
    };

    return (
        <>
            <form id={css.container}>
                {FORM_SCHEMA.map(field => {
                    if (field.type === 'repeatable') return null;

                    return (
                        <div key={field.id} className={css.entryContainer}>
                            <label className={css.label}>{field.label}</label>

                            {field.type === 'select' ? (
                                <select
                                    className={css.select}
                                    value={formData[field.id]}
                                    onChange={(e) =>
                                        updateField(setFormData, field.id, e.target.value)
                                    }
                                    disabled={!isEnabled(field)}
                                >
                                    {SELECT_DATA[field.data].list.map(
                                        (item, index) => (
                                            <option key={index} value={item.value}>{item.name}</option>
                                        )
                                    )}
                                </select>
                            ) : field.type === 'textarea' ? (
                                <div id={css[field.id]}>
                                    <textarea
                                        className={css.textarea}
                                        value={formData[field.id]}
                                        onChange={(e) =>
                                            updateField(setFormData, field.id, e.target.value)
                                        }
                                        disabled={!isEnabled(field)}
                                    />
                                    {field.id === 'job_description' && (
                                        <>
                                            <Button
                                                type="button"
                                                id={css.expandButton}
                                                command="show-modal"
                                                commandfor="expand"
                                            >
                                                Expand
                                            </Button>
                                            <JobDescriptionDialog
                                                value={formData[field.id]}
                                                onChange={(e) =>
                                                    updateField(setFormData, field.id, e.target.value)
                                                }
                                                disabled={!isEnabled(field)}
                                            />
                                        </>
                                    )}
                                </div>
                            ) : (
                                <input
                                    className={css.input}
                                    style={{
                                        width: field.type !== 'checkbox' ? '100%' : '30px'
                                    }}
                                    type={field.type}
                                    value={field.type !== 'checkbox' ? formData[field.id] : undefined}
                                    checked={field.type === 'checkbox' ? formData[field.id] : undefined}
                                    onChange={(e) =>
                                        field.type === 'checkbox'
                                            ? updateCheckbox(setFormData, FORM_SCHEMA, field.id, e.target.checked)
                                            : updateField(setFormData, field.id, e.target.value)
                                    }
                                    onBlur={(e) => {
                                        if (field.currency) {
                                            updateField(
                                                setFormData,
                                                field.id,
                                                formatCurrency(e.target.value)
                                            );
                                        }
                                    }}
                                    disabled={!isEnabled(field)}
                                />
                            )}
                        </div>
                    );
                })}

                {FORM_SCHEMA.filter(f => f.type === 'repeatable').map(field => {
                    if (!formData[field.toggle]) return null;

                    return (
                        <DynamicSection
                            key={field.id}
                            field={field}
                            rows={formData[field.id]}
                            addRow={(id) => addRow(setFormData, id)}
                            updateRow={(...args) => updateRow(setFormData, ...args)}
                            removeRow={(id, index) => removeRow(setFormData, id, index)}
                        />
                    );
                })}
            </form>
            <Dialog formData={formData} />
            <div id={css.formButtonContainer}>
                <Button id={css.clearButton} onClick={() => setFormData(buildInitialState(FORM_SCHEMA))}>
                    Clear
                </Button>
                <Button id={css.submitButton} command="show-modal" commandfor="dialog">
                    Map Data
                </Button>
            </div>
        </>
    );
};

export default Form;