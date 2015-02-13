from setuptools import setup, find_packages

setup(
    name='ckanext-timeline',
    version='0.2.1',
    description="CKAN extension for timeline facet",
    long_description=
    """
    """,
    classifiers=[],  # Get strings from http://pypi.python.org/pypi?%3Aaction=list_classifiers
    keywords='ckan ckanext timeline facet',
    author='Mikael Karlsson',
    author_email='i8myshoes@gmail.com',
    url='https://github.com/B2FIND/ckanext-timeline',
    license='AGPLv3',
    packages=find_packages(exclude=['ez_setup', 'examples', 'tests']),
    namespace_packages=['ckanext', 'ckanext.timeline'],
    include_package_data=True,
    zip_safe=False,
    install_requires=[
        # -*- Extra requirements: -*-
    ],
    entry_points=
    """
    [ckan.plugins]
    timeline=ckanext.timeline.plugin:TimelinePlugin
    """,
)
