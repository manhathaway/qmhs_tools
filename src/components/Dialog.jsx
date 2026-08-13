import css from './Dialog.module.css';
import { useMemo, useEffect } from 'react';
import Button from './subcomponents/Button';
import { SALESMEN, SOURCES } from '../data.js';
import { formatCurrency } from '../formHelpers.js';
import {
    getClass,
    getRegion,
    getStatus,
    getSource,
    buildAddressText,
    buildEstimateText,
    buildNoteText,
    getSelectedEntry,
    required,
    verifyFields
} from '../dialogHelpers.js';

const CopyText = ({ children, validate, overideValidateData, overideClipboard, overideValidate, ...props }) => {
    return (
        <div
            onClick={() =>
                navigator.clipboard.writeText(overideClipboard || children)
            }
            className={css.CopyText}
            style={{
                backgroundColor: verifyFields(overideValidateData || children)
                    ? 'rgba(0,255,0,0.1)'
                    : 'rgba(255,0,0,0.1)'
            }}
            {...props}
        >
            {children}
        </div>
    )
};

const Dialog = ({ formData }) => {
    const formattedFields = {
        address_name: formData.name.replace(' ', '').split(',').reverse().join(' '),
        contract_date: formData.contract_date.split('-').slice(1).concat(formData.contract_date.split('-')[0]).join('/'),
        price_number: Number(formData.price.replace(/[^0-9.-]+/g, "")),
        deposit_number: Number(formData.deposit.replace(/[^0-9.-]+/g, ""))
    };

    const selectedData = {
        salesman: getSelectedEntry(SALESMEN, formData.salesman),
        source: getSelectedEntry(SOURCES, formData.source)
    };

    const addressTextData = {
        address_name: required(formattedFields.address_name, '[MISSING NAME]'),
        address: required(formData.address, '[MISSING ADDRESS]')
    };

    const estimateTextData = {
        job_description: required(formData.job_description, '*** DESCRIPTION TO BE TYPED ***'),
        financed: formData.financed,
        amount_financed: required(formData.amount_financed),
        account_number: required(formData.account_number),
        progress_payments: required(formData.progress_payments),
        discounts: required(formData.discounts),
        price: required(formData.price),
        deposit: required(formData.deposit),
        deposit_type: formData.deposit_type,
        balance: formatCurrency(formattedFields.price_number - formattedFields.deposit_number)
    };

    const estimateDetailsData = {
        class: required(getClass(selectedData.salesman, null, formData.address)),
        contract_date: required(formattedFields.contract_date),
        salesman: required(selectedData.salesman && selectedData.salesman.value),
        source: required(getSource(selectedData.source)),
        price: required(formattedFields.price_number)
    };

    const noteTextData = {
        contract_date: required(formattedFields.contract_date),
        price: required(formData.price),
        salesman: required(selectedData.salesman && selectedData.salesman.name),
        email_date: required(formData.email_date)
    }

    const excelRowData = {
        Region: required(getRegion(selectedData.salesman, null, formData.address)),
        Date: required(formattedFields.contract_date),
        Salesman: required(selectedData.salesman && selectedData.salesman.name),
        Customer: required(formData.name),
        Job: required(formData.job_name),
        Price: required(formattedFields.price_number),
        Status: required(getStatus(selectedData.salesman))
    };

    return (
        <dialog id="dialog" className={css.dialog}>
            <div id={css.dialogContainer}>
                {formData.new_customer &&
                    <div id={css.newCustomerContainer} className={css.imageContainer}>
                        <CopyText id={css.name}>{required(formData.name)}</CopyText>
                        <CopyText id={css.address}>{buildAddressText(addressTextData)}</CopyText>
                    </div>
                }
                <div id={css.addJobContainer} className={css.imageContainer}>
                    <CopyText id={css.job_name}>{required(formData.job_name)}</CopyText>
                </div>
                <div id={css.estimateDetailsContainer} className={css.imageContainer}>
                    {Object.entries(estimateDetailsData).map(([key, value], index) =>
                        <CopyText key={index} id={css[key]}>{value}</CopyText>
                    )}
                </div>
                <div id={css.estimateDescriptionContainer} className={css.imageContainer}>
                    <CopyText id={css.job_description}>{buildEstimateText(estimateTextData)}</CopyText>
                </div>
                <div id={css.crmNoteContainer} className={css.imageContainer}>
                    <CopyText id={css.crm_note}>{buildNoteText(noteTextData)}</CopyText>
                </div>
                <CopyText
                    id={css.excelRowContainer}
                    overideClipboard={Object.values(excelRowData).join('\t')}
                    overideValidateData={excelRowData}
                >
                    <table>
                        <tr>
                            {Object.keys(excelRowData).map((heading, index) =>
                                <th key={index} className={css.excelRowHeaders}>{heading}</th>
                            )}
                        </tr>
                        <tr>
                            {Object.values(excelRowData).map((data, index) =>
                                <td key={index} className={css.excelRowData}>{data}</td>
                            )}
                        </tr>
                    </table>
                </CopyText>
            </div>

            <div id={css.closeButtonContainer}>
                <Button id={css.closeButton} commandfor="dialog" command="close">
                    Close
                </Button>
            </div>
        </dialog>
    );
};

export default Dialog;